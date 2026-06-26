const express = require('express');

const router = express.Router();

// import routes
const authRoutes = require('./auth.routes');
const dashboardRoutes = require('./dashboardRoutes');

const clinicRoutes = require('./clinicRoutes');
const featureRoutes = require('./featureRoutes');
const userTypeRoutes = require('./userTypeRoutes');
const loginPriceRoutes = require('./loginPriceRoutes');
const subscriptionSetupRoutes = require('./subscriptionSetupRoutes');
const billingRoutes = require('./billingRoutes');
const subscriptionUserRoutes = require('./subscriptionUserRoutes');
const departmentRoutes = require('./departmentRoutes');
const roleRoutes = require('./roleRoutes');
const staffLoginAccessRoutes = require('./staffLoginAccess.routes');
const accountSetupRoutes = require('./accountSetup.routes');
const referralRoutes = require('./referral.routes');


// tenant routes
const staffRoutes = require('./tenant/staffRoutes');
const assetRoutes = require('./tenant/assetRoutes');
const inventoryRoutes = require('./tenant/inventoryRoutes');
const vendorRoutes = require('./tenant/vendorRoutes');
const purchaseOrderRoutes = require('./tenant/purchaseOrderRoutes');
const medicalBillRoutes = require('./tenant/medicalBillRoutes');
const patientTokenRoutes = require('./tenant/patientTokenRoutes');
const doctorCallBoardRoutes = require('./tenant/doctorCallBoardRoutes');
const patientRoutes = require('./tenant/patient.routes');
const clientDashboardRoutes = require('./tenant/clientDashboardRoutes');
const departmentFieldConfigRoutes = require('./tenant/departmentFieldConfigRoutes');
const reportRoutes = require('./tenant/reports.routes');

const wardRoutes = require('./tenant/wardRoutes');
const roomRoutes = require('./tenant/roomRoutes');
const bedRoutes = require('./tenant/bedRoutes');
const ipdAdmissionRoutes = require('./tenant/ipdAdmissionRoutes');
const staffAttendanceRoutesModule = require('./tenant/staffAttendanceRoutes');
const staffAttendanceRoutes =
    staffAttendanceRoutesModule.default || staffAttendanceRoutesModule;
    
const staffPayslipRoutesModule = require('./tenant/staffPayslipRoutes');
const staffPayslipRoutes = staffPayslipRoutesModule.default || staffPayslipRoutesModule;


// main routes
router.use('/auth', authRoutes);
router.use('/account-setup', accountSetupRoutes);
router.use('/referral', referralRoutes);

router.use('/dashboard', dashboardRoutes);
router.use('/clinic', clinicRoutes);
router.use('/features', featureRoutes);
router.use('/user-types', userTypeRoutes);
router.use('/login-prices', loginPriceRoutes);
router.use('/subscription-setup', subscriptionSetupRoutes);
router.use('/billings', billingRoutes);
router.use('/subscription-user', subscriptionUserRoutes);
router.use('/departments', departmentRoutes);
router.use('/roles', roleRoutes);
router.use('/staff-login-access', staffLoginAccessRoutes);

// tenant routes
router.use('/staff', staffRoutes);
router.use('/assets', assetRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/vendors', vendorRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);
router.use('/medical-bills', medicalBillRoutes);
router.use('/patient-tokens', patientTokenRoutes);
router.use('/doctor-call-board', doctorCallBoardRoutes);
router.use('/patients', patientRoutes);
router.use('/client-dashboard', clientDashboardRoutes);
router.use('/department-field-configs', departmentFieldConfigRoutes);

router.use('/reports', reportRoutes);


router.use('/wards', wardRoutes);
router.use('/rooms', roomRoutes);
router.use('/beds', bedRoutes);
router.use('/ipd/admissions', ipdAdmissionRoutes);
router.use('/staff-attendance', staffAttendanceRoutes);

router.use('/staff-payslips', staffPayslipRoutes);



module.exports = router;