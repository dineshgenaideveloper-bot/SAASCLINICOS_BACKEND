// server/controllers/dashboardController.js

const Clinic = require('../models/Clinic');
const User = require('../models/User');
const Billing = require('../models/Billing');

const getDashboard = async (req, res) => {
  try {
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    res.status(200).json({
      success: true,
      data: {
        pendingBills: 18,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Dashboard fetch failed',
      error: error.message,
    });
  }
};

const getSaasDashboard = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const currentDate = new Date();

    // Calculate date ranges based on period
    let currentPeriodStart, previousPeriodStart, previousPeriodEnd;
    
    if (period === 'month') {
      currentPeriodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      previousPeriodStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      previousPeriodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
    } else if (period === 'quarter') {
      const currentQuarter = Math.floor(currentDate.getMonth() / 3);
      currentPeriodStart = new Date(currentDate.getFullYear(), currentQuarter * 3, 1);
      previousPeriodStart = new Date(currentDate.getFullYear(), (currentQuarter - 1) * 3, 1);
      previousPeriodEnd = new Date(currentDate.getFullYear(), currentQuarter * 3, 0);
    } else { // year
      currentPeriodStart = new Date(currentDate.getFullYear(), 0, 1);
      previousPeriodStart = new Date(currentDate.getFullYear() - 1, 0, 1);
      previousPeriodEnd = new Date(currentDate.getFullYear() - 1, 11, 31);
    }

    // Fetch all data in parallel for better performance
    const [
      totalClinics,
      activeClinics,
      inactiveClinics,
      totalUsers,
      activeUsers,
      totalRevenueResult,
      monthlyRevenueResult,
      previousRevenueResult,
      pendingBills,
      paidBills,
      cancelledBills,
      overdueBills,
      recentBillings,
      recentClinics,
      allBillings,
      allClinics,
      allPaidBillings,
    ] = await Promise.all([
      Clinic.countDocuments(),
      Clinic.countDocuments({ isActive: true }),
      Clinic.countDocuments({ isActive: false }),
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      
      // Total revenue from paid bills
      Billing.aggregate([
        { $match: { status: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      
      // Current period revenue
      Billing.aggregate([
        { 
          $match: { 
            status: 'Paid',
            createdAt: { $gte: currentPeriodStart }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      
      // Previous period revenue for growth calculation
      Billing.aggregate([
        { 
          $match: { 
            status: 'Paid',
            createdAt: { $gte: previousPeriodStart, $lte: previousPeriodEnd }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      
      Billing.countDocuments({ status: 'Pending' }),
      Billing.countDocuments({ status: 'Paid' }),
      Billing.countDocuments({ status: 'Cancelled' }),
      Billing.countDocuments({ status: 'Overdue' }),
      
      Billing.find()
        .populate('clinic', 'name tenantId')
        .sort({ createdAt: -1 })
        .limit(5),
      
      Clinic.find()
        .populate('owner', 'name email role')
        .sort({ createdAt: -1 })
        .limit(5),
        
      Billing.find().populate('clinic', 'name tenantId'),
      
      Clinic.find().populate('owner', 'name email'),
      
      Billing.find({ status: 'Paid' }).populate('clinic', 'name tenantId'),
    ]);

    // Calculate totals
    const totalRevenue = totalRevenueResult[0]?.total || 0;
    const monthlyRevenue = monthlyRevenueResult[0]?.total || 0;
    const previousRevenue = previousRevenueResult[0]?.total || 0;
    
    // Calculate revenue growth
    let revenueGrowth = 0;
    if (previousRevenue > 0) {
      revenueGrowth = ((monthlyRevenue - previousRevenue) / previousRevenue) * 100;
    } else if (monthlyRevenue > 0) {
      revenueGrowth = 100;
    }
    
    // Calculate total bills amount
    const totalBillsAmount = allBillings.reduce((sum, bill) => sum + (bill.amount || 0), 0);
    
    // Calculate collection rate
    const collectionRate = totalBillsAmount > 0 ? (totalRevenue / totalBillsAmount) * 100 : 0;
    
    // Calculate yearly revenue (last 12 months)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const yearlyRevenue = allBillings
      .filter(b => b.status === 'Paid' && new Date(b.createdAt) >= oneYearAgo)
      .reduce((sum, b) => sum + (b.amount || 0), 0);
    
    // Calculate pending amount
    const pendingAmount = allBillings
      .filter(b => b.status === 'Pending' || b.status === 'Overdue')
      .reduce((sum, b) => sum + (b.amount || 0), 0);
    
    // Calculate active subscriptions (paid bills with end date in future)
    const activeSubscriptions = allPaidBillings.filter(b => 
      b.endDate && new Date(b.endDate) > new Date()
    ).length;
    
    // Calculate expiring subscriptions (within next 7 days)
    const expiringSubscriptions = allPaidBillings.filter(b => 
      b.endDate && 
      new Date(b.endDate) > new Date() && 
      new Date(b.endDate) - new Date() < 7 * 24 * 60 * 60 * 1000
    ).length;
    
    // Calculate top clinics by revenue
    const clinicRevenueMap = new Map();
    allPaidBillings.forEach(bill => {
      const clinicId = bill.clinic?._id?.toString();
      if (clinicId) {
        const current = clinicRevenueMap.get(clinicId) || { revenue: 0, count: 0, lastPayment: null };
        current.revenue += bill.amount || 0;
        current.count++;
        if (!current.lastPayment || new Date(bill.createdAt) > new Date(current.lastPayment)) {
          current.lastPayment = bill.createdAt;
        }
        clinicRevenueMap.set(clinicId, current);
      }
    });
    
    const topClinicsByRevenue = await Promise.all(
      Array.from(clinicRevenueMap.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5)
        .map(async ([clinicId, data]) => {
          const clinic = allClinics.find(c => c._id.toString() === clinicId);
          return {
            _id: clinicId,
            name: clinic?.name || 'Unknown',
            tenantId: clinic?.tenantId || 'N/A',
            totalRevenue: data.revenue,
            billsCount: data.count,
            lastPayment: data.lastPayment,
          };
        })
    );
    
    // Calculate monthly stats for the last 6 months
    const monthlyStats = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthName = monthDate.toLocaleString('default', { month: 'short' });
      const year = monthDate.getFullYear();
      const nextMonth = new Date(year, monthDate.getMonth() + 1, 1);
      
      const monthBillings = allBillings.filter(b => 
        new Date(b.createdAt) >= monthDate && 
        new Date(b.createdAt) < nextMonth
      );
      
      const monthRevenue = monthBillings
        .filter(b => b.status === 'Paid')
        .reduce((sum, b) => sum + (b.amount || 0), 0);
      
      const previousMonthDate = new Date(year, monthDate.getMonth() - 1, 1);
      const previousMonthBillings = allBillings.filter(b => 
        new Date(b.createdAt) >= previousMonthDate && 
        new Date(b.createdAt) < monthDate
      );
      const previousRevenue = previousMonthBillings
        .filter(b => b.status === 'Paid')
        .reduce((sum, b) => sum + (b.amount || 0), 0);
      
      let monthGrowth = 0;
      if (previousRevenue > 0) {
        monthGrowth = ((monthRevenue - previousRevenue) / previousRevenue) * 100;
      } else if (monthRevenue > 0) {
        monthGrowth = 100;
      }
      
      monthlyStats.push({
        month: `${monthName} ${year}`,
        revenue: monthRevenue,
        billsCount: monthBillings.length,
        growth: Math.round(monthGrowth),
      });
    }
    
    // Calculate billing by status breakdown
    const billingByStatus = {
      paid: paidBills,
      pending: pendingBills,
      overdue: overdueBills,
      cancelled: cancelledBills,
    };
    
    // Get billing statistics for cards
    const totalBills = paidBills + pendingBills + overdueBills + cancelledBills;
    const paidPercentage = totalBills > 0 ? (paidBills / totalBills) * 100 : 0;
    const pendingPercentage = totalBills > 0 ? (pendingBills / totalBills) * 100 : 0;
    const overduePercentage = totalBills > 0 ? (overdueBills / totalBills) * 100 : 0;

    res.json({
      success: true,
      data: {
        // Basic counts
        totalClinics,
        activeClinics,
        inactiveClinics,
        totalUsers,
        activeUsers,
        
        // Revenue data
        totalRevenue,
        monthlyRevenue,
        yearlyRevenue,
        revenueGrowth: Math.round(revenueGrowth),
        
        // Billing data
        pendingBills,
        paidBills,
        cancelledBills,
        overdueBills: overdueBills || 0,
        totalBillsAmount,
        collectionRate: Math.round(collectionRate),
        pendingAmount,
        
        // Subscription data
        activeSubscriptions,
        expiringSubscriptions,
        
        // Percentage breakdowns
        billingBreakdown: {
          paid: Math.round(paidPercentage),
          pending: Math.round(pendingPercentage),
          overdue: Math.round(overduePercentage),
        },
        
        // Recent items
        recentBillings,
        recentClinics,
        
        // Top performers
        topClinicsByRevenue,
        
        // Monthly trends
        monthlyStats,
        
        // Status breakdown for charts
        billingByStatus,
      },
    });
  } catch (error) {
    console.error('SAAS Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SAAS dashboard',
      error: error.message,
    });
  }
};

module.exports = {
  getDashboard,
  getSaasDashboard,
};