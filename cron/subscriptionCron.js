// cron/subscriptionCron.js (Updated)
const cron = require('node-cron');
const Billing = require('../models/Billing');
const SubscriptionPermission = require('../models/SubscriptionPermission');

// Helper to check for existing bill in period
const checkExistingBillForPeriod = async (tenantId, startDate, endDate) => {
  return await Billing.findOne({
    tenantId,
    status: { $in: ['Pending', 'Paid'] },
    $or: [
      {
        startDate: { $lt: endDate },
        endDate: { $gt: startDate }
      },
      {
        startDate: startDate,
        endDate: endDate
      }
    ]
  });
};

const startSubscriptionCron = () => {
  
  // Run every day at 00:00 AM
  cron.schedule('0 0 * * *', async () => {
    console.log('Running subscription cron job...', new Date().toISOString());
    
    try {
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      // Find active subscriptions expiring in <= 3 days
      const expiringSubscriptions = await SubscriptionPermission.find({
        isActive: true,
        subscriptionEndDate: { 
          $lte: threeDaysFromNow,
          $gte: now
        }
      }).populate('clinic');
      
      console.log(`Found ${expiringSubscriptions.length} expiring subscriptions`);
      
      for (const subscription of expiringSubscriptions) {
        // Calculate next period dates
        const nextStartDate = new Date(subscription.subscriptionEndDate);
        nextStartDate.setDate(nextStartDate.getDate() + 1);
        
        const nextEndDate = new Date(nextStartDate);
        nextEndDate.setDate(nextEndDate.getDate() + 30);
        
        // CRITICAL: Check if next bill already exists for this period
        const existingNextBill = await checkExistingBillForPeriod(
          subscription.tenantId, 
          nextStartDate, 
          nextEndDate
        );
        
        if (!existingNextBill) {
          // Also check if there's any pending bill that covers this period
          const pendingBill = await Billing.findOne({
            tenantId: subscription.tenantId,
            status: 'Pending',
            endDate: { $gte: nextStartDate }
          });
          
          if (!pendingBill) {
            // Generate next bill
            const billCount = await Billing.countDocuments({ tenantId: subscription.tenantId });
            const invoiceNo = `INV-${subscription.tenantId}-${Date.now()}-${billCount + 1}`;
            
            const newBill = await Billing.create({
              tenantId: subscription.tenantId,
              clinic: subscription.clinic._id,
              invoiceNo,
              startDate: nextStartDate,
              endDate: nextEndDate,
              dueDate: nextEndDate,
              amount: subscription.finalPrice,
              status: 'Pending',
              description: `Auto-generated bill for period ${nextStartDate.toLocaleDateString()} to ${nextEndDate.toLocaleDateString()}`,
              billPeriod: billCount + 1,
              generatedBy: 'auto',
            });
            
            // Update subscription
            subscription.nextBillGenerationDate = new Date(nextEndDate.getTime() - 3 * 24 * 60 * 60 * 1000);
            subscription.lastBillGenerated = new Date();
            await subscription.save();
            
            console.log(`Generated next bill for ${subscription.tenantId}: ${invoiceNo}`);
          } else {
            console.log(`Pending bill already exists for ${subscription.tenantId}, skipping auto-generation`);
          }
        } else {
          console.log(`Bill already exists for period for ${subscription.tenantId}, skipping auto-generation`);
        }
      }
      
      // Check for expired unpaid subscriptions
      const expiredSubscriptions = await SubscriptionPermission.find({
        isActive: true,
        subscriptionEndDate: { $lt: now }
      }).populate('clinic');
      
      console.log(`Found ${expiredSubscriptions.length} expired subscriptions`);
      
      for (const subscription of expiredSubscriptions) {
        // Check if there's an unpaid bill for this period
        const unpaidBill = await Billing.findOne({
          tenantId: subscription.tenantId,
          endDate: subscription.subscriptionEndDate,
          status: { $in: ['Pending', 'Overdue'] }
        });
        
        if (unpaidBill) {
          // Deactivate subscription
          subscription.isActive = false;
          await subscription.save();
          
          // Mark bill as overdue
          unpaidBill.status = 'Overdue';
          await unpaidBill.save();
          
          console.log(`Deactivated subscription for ${subscription.tenantId} due to non-payment`);
        }
      }
      
      console.log('Subscription cron job completed');
    } catch (error) {
      console.error('Error in subscription cron job:', error);
    }
  });
  
  // Also run every hour for more responsive checks
  cron.schedule('0 * * * *', async () => {
    console.log('Running hourly subscription check...', new Date().toISOString());
    
    try {
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      const criticalSubscriptions = await SubscriptionPermission.find({
        isActive: true,
        subscriptionEndDate: { 
          $lte: threeDaysFromNow,
          $gte: now
        },
        nextBillGenerationDate: { $lte: now }
      }).populate('clinic');
      
      for (const subscription of criticalSubscriptions) {
        const nextStartDate = new Date(subscription.subscriptionEndDate);
        nextStartDate.setDate(nextStartDate.getDate() + 1);
        
        const nextEndDate = new Date(nextStartDate);
        nextEndDate.setDate(nextEndDate.getDate() + 30);
        
        const existingNextBill = await checkExistingBillForPeriod(
          subscription.tenantId, 
          nextStartDate, 
          nextEndDate
        );
        
        if (!existingNextBill) {
          const billCount = await Billing.countDocuments({ tenantId: subscription.tenantId });
          const invoiceNo = `INV-${subscription.tenantId}-${Date.now()}-${billCount + 1}`;
          
          await Billing.create({
            tenantId: subscription.tenantId,
            clinic: subscription.clinic._id,
            invoiceNo,
            startDate: nextStartDate,
            endDate: nextEndDate,
            dueDate: nextEndDate,
            amount: subscription.finalPrice,
            status: 'Pending',
            description: `Auto-generated bill (urgent) for period ${nextStartDate.toLocaleDateString()} to ${nextEndDate.toLocaleDateString()}`,
            billPeriod: billCount + 1,
            generatedBy: 'auto',
          });
          
          subscription.nextBillGenerationDate = new Date(nextEndDate.getTime() - 3 * 24 * 60 * 60 * 1000);
          await subscription.save();
          
          console.log(`Generated urgent bill for ${subscription.tenantId}`);
        }
      }
    } catch (error) {
      console.error('Error in hourly subscription check:', error);
    }
  });
};

module.exports = startSubscriptionCron;