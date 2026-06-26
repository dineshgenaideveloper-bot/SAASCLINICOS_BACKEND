// server/controllers/tenant/reports.controller.js
//
// All reports live in one registry. Each entry:
//   key: { title, category, govt, params, generate(db, range, query) -> { columns, rows, summary } }
//
// db is req.tenantDb. We load tenant models from it on demand.

const { getDateRange } = require('../../utils/reportDateRange');
const { exportReport } = require('../../utils/reportExporter');

const PatientModel = require('../../models/tenant/Patient');
const ItemMasterModel = require('../../models/tenant/ItemMaster');
const MedicalBillModel = require('../../models/tenant/MedicalBill');
const PurchaseOrderModel = require('../../models/tenant/PurchaseOrder');
const StockTransactionModel = require('../../models/tenant/StockTransaction');
const VendorModel = require('../../models/tenant/Vendor');

const sum = (arr, f) => arr.reduce((a, b) => a + (Number(f(b)) || 0), 0);

/* ============================================================================
   1. PATIENT / OPD
============================================================================ */

async function dailyVisits(db, range) {
  const Patient = PatientModel(db);
  const rows = await Patient.aggregate([
    { $unwind: '$visits' },
    { $match: { 'visits.visitDate': { $gte: range.start, $lte: range.end } } },
    { $project: {
      _id: 0,
      visitDate: '$visits.visitDate',
      tokenNumber: '$visits.tokenNumber',
      patientId: '$patientId',
      name: '$name',
      phone: '$phone',
      department: '$visits.departmentName',
      doctor: '$visits.doctorName',
      complaint: '$visits.generalEnquiry.chiefComplaint',
      status: '$visits.status',
    } },
    { $sort: { visitDate: 1 } },
  ]);
  return {
    columns: [
      { key: 'visitDate', label: 'Date/Time', type: 'datetime' },
      { key: 'tokenNumber', label: 'Token', type: 'text' },
      { key: 'patientId', label: 'Patient ID', type: 'text' },
      { key: 'name', label: 'Patient', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'department', label: 'Department', type: 'text' },
      { key: 'doctor', label: 'Doctor', type: 'text' },
      { key: 'complaint', label: 'Chief Complaint', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    rows,
    summary: [{ label: 'Total Visits', value: rows.length, type: 'number' }],
  };
}

async function newVsReturning(db, range) {
  const Patient = PatientModel(db);
  const agg = await Patient.aggregate([
    { $unwind: '$visits' },
    { $group: {
      _id: '$_id',
      firstVisit: { $min: '$visits.visitDate' },
      inRange: { $sum: { $cond: [{ $and: [
        { $gte: ['$visits.visitDate', range.start] },
        { $lte: ['$visits.visitDate', range.end] },
      ] }, 1, 0] } },
    } },
    { $match: { inRange: { $gt: 0 } } },
    { $group: {
      _id: null,
      newPatients: { $sum: { $cond: [{ $gte: ['$firstVisit', range.start] }, 1, 0] } },
      returningPatients: { $sum: { $cond: [{ $lt: ['$firstVisit', range.start] }, 1, 0] } },
    } },
  ]);
  const r = agg[0] || { newPatients: 0, returningPatients: 0 };
  const rows = [
    { type: 'New patients', count: r.newPatients },
    { type: 'Returning patients', count: r.returningPatients },
  ];
  return {
    columns: [
      { key: 'type', label: 'Patient Type', type: 'text' },
      { key: 'count', label: 'Count', type: 'number' },
    ],
    rows,
    summary: [{ label: 'Total Unique Patients', value: r.newPatients + r.returningPatients, type: 'number' }],
  };
}

async function doctorLoad(db, range) {
  const Patient = PatientModel(db);
  const rows = await Patient.aggregate([
    { $unwind: '$visits' },
    { $match: { 'visits.visitDate': { $gte: range.start, $lte: range.end } } },
    { $group: { _id: { $ifNull: ['$visits.doctorName', 'Unassigned'] }, visits: { $sum: 1 } } },
    { $project: { _id: 0, doctor: '$_id', visits: 1 } },
    { $sort: { visits: -1 } },
  ]);
  return {
    columns: [
      { key: 'doctor', label: 'Doctor', type: 'text' },
      { key: 'visits', label: 'Patients Seen', type: 'number' },
    ],
    rows,
    summary: [{ label: 'Total Visits', value: sum(rows, (r) => r.visits), type: 'number' }],
  };
}

async function departmentCount(db, range) {
  const Patient = PatientModel(db);
  const rows = await Patient.aggregate([
    { $unwind: '$visits' },
    { $match: { 'visits.visitDate': { $gte: range.start, $lte: range.end } } },
    { $group: { _id: { $ifNull: ['$visits.departmentName', 'Unspecified'] }, visits: { $sum: 1 } } },
    { $project: { _id: 0, department: '$_id', visits: 1 } },
    { $sort: { visits: -1 } },
  ]);
  return {
    columns: [
      { key: 'department', label: 'Department', type: 'text' },
      { key: 'visits', label: 'Patient Count', type: 'number' },
    ],
    rows,
    summary: [{ label: 'Total Visits', value: sum(rows, (r) => r.visits), type: 'number' }],
  };
}

async function footfallHourly(db, range) {
  const Patient = PatientModel(db);
  const rows = await Patient.aggregate([
    { $unwind: '$visits' },
    { $match: { 'visits.visitDate': { $gte: range.start, $lte: range.end } } },
    { $group: { _id: { $hour: '$visits.visitDate' }, visits: { $sum: 1 } } },
    { $project: { _id: 0, hour: '$_id', visits: 1 } },
    { $sort: { hour: 1 } },
  ]);
  const mapped = rows.map((r) => ({
    slot: `${String(r.hour).padStart(2, '0')}:00 - ${String(r.hour).padStart(2, '0')}:59`,
    visits: r.visits,
  }));
  return {
    columns: [
      { key: 'slot', label: 'Hour Slot', type: 'text' },
      { key: 'visits', label: 'Visits', type: 'number' },
    ],
    rows: mapped,
    summary: [{ label: 'Total Visits', value: sum(mapped, (r) => r.visits), type: 'number' }],
  };
}

async function patientDemographics(db) {
  const Patient = PatientModel(db);
  const byGender = await Patient.aggregate([
    { $group: { _id: { $ifNull: ['$gender', 'Unknown'] }, count: { $sum: 1 } } },
    { $project: { _id: 0, bucket: '$_id', count: 1 } },
  ]);
  const buckets = await Patient.aggregate([
    { $addFields: { ageNum: { $convert: { input: '$age', to: 'int', onError: -1, onNull: -1 } } } },
    { $bucket: {
      groupBy: '$ageNum',
      boundaries: [0, 13, 18, 31, 46, 61, 200],
      default: 'Unknown',
      output: { count: { $sum: 1 } },
    } },
  ]);
  const ageLabels = { 0: '0-12', 13: '13-17', 18: '18-30', 31: '31-45', 46: '46-60', 61: '60+' };
  const rows = [];
  byGender.forEach((g) => rows.push({ category: 'Gender', bucket: g.bucket, count: g.count }));
  buckets.forEach((b) => rows.push({ category: 'Age', bucket: ageLabels[b._id] || 'Unknown', count: b.count }));
  return {
    columns: [
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'bucket', label: 'Group', type: 'text' },
      { key: 'count', label: 'Patients', type: 'number' },
    ],
    rows,
  };
}

async function patientRegister(db, range) {
  // Medico-legal register — every registered patient (or those active in range)
  const Patient = PatientModel(db);
  const rows = await Patient.aggregate([
    { $match: { createdAt: { $gte: range.start, $lte: range.end } } },
    { $project: {
      _id: 0, patientId: 1, name: 1, phone: 1, age: 1, gender: 1, address: 1,
      registeredOn: '$createdAt', visitCount: { $size: { $ifNull: ['$visits', []] } },
    } },
    { $sort: { registeredOn: 1 } },
  ]);
  return {
    columns: [
      { key: 'patientId', label: 'Patient ID', type: 'text' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'age', label: 'Age', type: 'text' },
      { key: 'gender', label: 'Gender', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'registeredOn', label: 'Registered', type: 'date' },
      { key: 'visitCount', label: 'Visits', type: 'number' },
    ],
    rows,
    summary: [{ label: 'Patients Registered', value: rows.length, type: 'number' }],
  };
}

async function patientVisitHistory(db, range, query) {
  const Patient = PatientModel(db);
  const id = query.patientId; // ObjectId or PAT-code
  if (!id) return { columns: [], rows: [], note: 'Pass ?patientId=<id or PAT code>' };
  const match = /^[0-9a-fA-F]{24}$/.test(id) ? { _id: new (require('mongoose').Types.ObjectId)(id) } : { patientId: id };
  const rows = await Patient.aggregate([
    { $match: match },
    { $unwind: '$visits' },
    { $sort: { 'visits.visitDate': 1 } },
    { $project: {
      _id: 0,
      visitDate: '$visits.visitDate',
      department: '$visits.departmentName',
      doctor: '$visits.doctorName',
      complaint: '$visits.generalEnquiry.chiefComplaint',
      diagnosis: '$visits.generalEnquiry.history',
      medicines: { $size: { $ifNull: ['$visits.prescriptions', []] } },
      status: '$visits.status',
    } },
  ]);
  return {
    columns: [
      { key: 'visitDate', label: 'Date', type: 'datetime' },
      { key: 'department', label: 'Department', type: 'text' },
      { key: 'doctor', label: 'Doctor', type: 'text' },
      { key: 'complaint', label: 'Complaint', type: 'text' },
      { key: 'medicines', label: '# Medicines', type: 'number' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    rows,
  };
}

/* ============================================================================
   2. CLINICAL / PRESCRIPTION
============================================================================ */

async function prescriptionsSummary(db, range) {
  const Patient = PatientModel(db);
  const rows = await Patient.aggregate([
    { $unwind: '$visits' },
    { $match: { 'visits.visitDate': { $gte: range.start, $lte: range.end }, 'visits.prescriptions.0': { $exists: true } } },
    { $group: {
      _id: {
        day: { $dateToString: { format: '%Y-%m-%d', date: '$visits.visitDate' } },
        doctor: { $ifNull: ['$visits.doctorName', 'Unassigned'] },
      },
      prescriptions: { $sum: 1 },
      medicines: { $sum: { $size: '$visits.prescriptions' } },
    } },
    { $project: { _id: 0, day: '$_id.day', doctor: '$_id.doctor', prescriptions: 1, medicines: 1 } },
    { $sort: { day: 1, doctor: 1 } },
  ]);
  return {
    columns: [
      { key: 'day', label: 'Date', type: 'text' },
      { key: 'doctor', label: 'Doctor', type: 'text' },
      { key: 'prescriptions', label: 'Prescriptions', type: 'number' },
      { key: 'medicines', label: 'Medicines', type: 'number' },
    ],
    rows,
    summary: [
      { label: 'Total Prescriptions', value: sum(rows, (r) => r.prescriptions), type: 'number' },
      { label: 'Total Medicine Lines', value: sum(rows, (r) => r.medicines), type: 'number' },
    ],
  };
}

async function mostPrescribed(db, range) {
  const Patient = PatientModel(db);
  const rows = await Patient.aggregate([
    { $unwind: '$visits' },
    { $match: { 'visits.visitDate': { $gte: range.start, $lte: range.end } } },
    { $unwind: '$visits.prescriptions' },
    { $group: {
      _id: { $ifNull: ['$visits.prescriptions.itemName', 'Unknown'] },
      generic: { $first: '$visits.prescriptions.genericName' },
      category: { $first: '$visits.prescriptions.categoryName' },
      times: { $sum: 1 },
      qty: { $sum: { $ifNull: ['$visits.prescriptions.quantity', 0] } },
    } },
    { $project: { _id: 0, medicine: '$_id', generic: 1, category: 1, times: 1, qty: 1 } },
    { $sort: { times: -1 } },
  ]);
  return {
    columns: [
      { key: 'medicine', label: 'Medicine', type: 'text' },
      { key: 'generic', label: 'Generic', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'times', label: 'Times Prescribed', type: 'number' },
      { key: 'qty', label: 'Total Qty', type: 'number' },
    ],
    rows,
  };
}

// Schedule register: join prescription items back to ItemMaster for `schedule`/`isControlled`
async function scheduleRegister(db, range, scheduleMatch) {
  const Patient = PatientModel(db);
  const rows = await Patient.aggregate([
    { $unwind: '$visits' },
    { $match: { 'visits.visitDate': { $gte: range.start, $lte: range.end } } },
    { $unwind: '$visits.prescriptions' },
    { $lookup: {
      from: 'itemmasters',
      localField: 'visits.prescriptions.item',
      foreignField: '_id',
      as: 'im',
    } },
    { $unwind: '$im' },
    { $match: scheduleMatch },
    { $project: {
      _id: 0,
      date: '$visits.visitDate',
      patientId: '$patientId',
      patient: '$name',
      phone: '$phone',
      medicine: '$im.name',
      schedule: '$im.schedule',
      qty: '$visits.prescriptions.quantity',
      doctor: '$visits.doctorName',
    } },
    { $sort: { date: 1 } },
  ]);
  return {
    columns: [
      { key: 'date', label: 'Date', type: 'datetime' },
      { key: 'patientId', label: 'Patient ID', type: 'text' },
      { key: 'patient', label: 'Patient', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'medicine', label: 'Medicine', type: 'text' },
      { key: 'schedule', label: 'Schedule', type: 'text' },
      { key: 'qty', label: 'Qty', type: 'number' },
      { key: 'doctor', label: 'Prescribed By', type: 'text' },
    ],
    rows,
    summary: [{ label: 'Total Entries', value: rows.length, type: 'number' }],
  };
}
const scheduleH1 = (db, range) => scheduleRegister(db, range, { 'im.schedule': { $regex: /^H1$/i } });
const scheduleX = (db, range) => scheduleRegister(db, range, { $or: [{ 'im.schedule': { $regex: /^X$/i } }, { 'im.isControlled': true }] });

async function antibioticUsage(db, range) {
  const Patient = PatientModel(db);
  const rows = await Patient.aggregate([
    { $unwind: '$visits' },
    { $match: { 'visits.visitDate': { $gte: range.start, $lte: range.end } } },
    { $unwind: '$visits.prescriptions' },
    { $match: { 'visits.prescriptions.categoryName': { $regex: /antibiotic/i } } },
    { $group: {
      _id: { $ifNull: ['$visits.prescriptions.itemName', 'Unknown'] },
      times: { $sum: 1 },
      qty: { $sum: { $ifNull: ['$visits.prescriptions.quantity', 0] } },
    } },
    { $project: { _id: 0, medicine: '$_id', times: 1, qty: 1 } },
    { $sort: { times: -1 } },
  ]);
  return {
    columns: [
      { key: 'medicine', label: 'Antibiotic', type: 'text' },
      { key: 'times', label: 'Times Prescribed', type: 'number' },
      { key: 'qty', label: 'Total Qty', type: 'number' },
    ],
    rows,
    note: 'Matches items whose category name contains "antibiotic".',
  };
}

/* ============================================================================
   3. BILLING & REVENUE
============================================================================ */

async function dailyCollection(db, range) {
  const Bill = MedicalBillModel(db);
  const rows = await Bill.aggregate([
    { $match: { createdAt: { $gte: range.start, $lte: range.end }, status: { $ne: 'cancelled' } } },
    { $group: {
      _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, mode: '$paymentMode' },
      amount: { $sum: '$grandTotal' },
      bills: { $sum: 1 },
    } },
    { $group: {
      _id: '$_id.day',
      cash: { $sum: { $cond: [{ $eq: ['$_id.mode', 'cash'] }, '$amount', 0] } },
      upi: { $sum: { $cond: [{ $eq: ['$_id.mode', 'upi'] }, '$amount', 0] } },
      card: { $sum: { $cond: [{ $eq: ['$_id.mode', 'card'] }, '$amount', 0] } },
      credit: { $sum: { $cond: [{ $eq: ['$_id.mode', 'credit'] }, '$amount', 0] } },
      total: { $sum: '$amount' },
      bills: { $sum: '$bills' },
    } },
    { $project: { _id: 0, day: '$_id', cash: 1, upi: 1, card: 1, credit: 1, total: 1, bills: 1 } },
    { $sort: { day: 1 } },
  ]);
  return {
    columns: [
      { key: 'day', label: 'Date', type: 'text' },
      { key: 'bills', label: 'Bills', type: 'number' },
      { key: 'cash', label: 'Cash', type: 'currency' },
      { key: 'upi', label: 'UPI', type: 'currency' },
      { key: 'card', label: 'Card', type: 'currency' },
      { key: 'credit', label: 'Credit', type: 'currency' },
      { key: 'total', label: 'Total', type: 'currency' },
    ],
    rows,
    summary: [
      { label: 'Total Cash', value: sum(rows, (r) => r.cash), type: 'currency' },
      { label: 'Total UPI', value: sum(rows, (r) => r.upi), type: 'currency' },
      { label: 'Total Card', value: sum(rows, (r) => r.card), type: 'currency' },
      { label: 'Total Credit', value: sum(rows, (r) => r.credit), type: 'currency' },
      { label: 'Grand Total', value: sum(rows, (r) => r.total), type: 'currency' },
    ],
  };
}

async function billRegister(db, range) {
  const Bill = MedicalBillModel(db);
  const rows = await Bill.aggregate([
    { $match: { createdAt: { $gte: range.start, $lte: range.end } } },
    { $project: {
      _id: 0, billNumber: 1, date: '$createdAt', patientName: 1, patientPhone: 1,
      items: { $size: { $ifNull: ['$items', []] } },
      subTotal: 1, discountAmount: 1, taxAmount: 1, grandTotal: 1,
      paymentMode: 1, status: 1,
    } },
    { $sort: { date: 1 } },
  ]);
  return {
    columns: [
      { key: 'billNumber', label: 'Bill No', type: 'text' },
      { key: 'date', label: 'Date', type: 'datetime' },
      { key: 'patientName', label: 'Patient', type: 'text' },
      { key: 'patientPhone', label: 'Phone', type: 'text' },
      { key: 'items', label: 'Items', type: 'number' },
      { key: 'subTotal', label: 'Sub Total', type: 'currency' },
      { key: 'discountAmount', label: 'Discount', type: 'currency' },
      { key: 'taxAmount', label: 'Tax', type: 'currency' },
      { key: 'grandTotal', label: 'Grand Total', type: 'currency' },
      { key: 'paymentMode', label: 'Mode', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    rows,
    summary: [
      { label: 'Total Bills', value: rows.length, type: 'number' },
      { label: 'Total Sales', value: sum(rows, (r) => r.grandTotal), type: 'currency' },
    ],
  };
}

async function itemWiseSales(db, range) {
  const Bill = MedicalBillModel(db);
  const rows = await Bill.aggregate([
    { $match: { createdAt: { $gte: range.start, $lte: range.end }, status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    { $group: {
      _id: { $ifNull: ['$items.itemName', 'Unknown'] },
      code: { $first: '$items.itemCode' },
      qty: { $sum: '$items.quantity' },
      taxable: { $sum: '$items.taxableAmount' },
      gst: { $sum: '$items.gstAmount' },
      total: { $sum: '$items.total' },
    } },
    { $project: { _id: 0, item: '$_id', code: 1, qty: 1, taxable: 1, gst: 1, total: 1 } },
    { $sort: { total: -1 } },
  ]);
  return {
    columns: [
      { key: 'item', label: 'Item', type: 'text' },
      { key: 'code', label: 'Code', type: 'text' },
      { key: 'qty', label: 'Qty Sold', type: 'number' },
      { key: 'taxable', label: 'Taxable', type: 'currency' },
      { key: 'gst', label: 'GST', type: 'currency' },
      { key: 'total', label: 'Total', type: 'currency' },
    ],
    rows,
    summary: [{ label: 'Total Sales', value: sum(rows, (r) => r.total), type: 'currency' }],
  };
}

async function paymentModeSplit(db, range) {
  const Bill = MedicalBillModel(db);
  const rows = await Bill.aggregate([
    { $match: { createdAt: { $gte: range.start, $lte: range.end }, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$paymentMode', bills: { $sum: 1 }, amount: { $sum: '$grandTotal' } } },
    { $project: { _id: 0, mode: '$_id', bills: 1, amount: 1 } },
    { $sort: { amount: -1 } },
  ]);
  return {
    columns: [
      { key: 'mode', label: 'Payment Mode', type: 'text' },
      { key: 'bills', label: 'Bills', type: 'number' },
      { key: 'amount', label: 'Amount', type: 'currency' },
    ],
    rows,
    summary: [{ label: 'Total Collection', value: sum(rows, (r) => r.amount), type: 'currency' }],
  };
}

async function discountsReport(db, range) {
  const Bill = MedicalBillModel(db);
  const rows = await Bill.aggregate([
    { $match: { createdAt: { $gte: range.start, $lte: range.end }, discountAmount: { $gt: 0 } } },
    { $project: { _id: 0, billNumber: 1, date: '$createdAt', patientName: 1, grandTotal: 1, discountAmount: 1 } },
    { $sort: { date: 1 } },
  ]);
  return {
    columns: [
      { key: 'billNumber', label: 'Bill No', type: 'text' },
      { key: 'date', label: 'Date', type: 'datetime' },
      { key: 'patientName', label: 'Patient', type: 'text' },
      { key: 'grandTotal', label: 'Bill Total', type: 'currency' },
      { key: 'discountAmount', label: 'Discount', type: 'currency' },
    ],
    rows,
    summary: [{ label: 'Total Discount Given', value: sum(rows, (r) => r.discountAmount), type: 'currency' }],
  };
}

async function cancelledBills(db, range) {
  const Bill = MedicalBillModel(db);
  const rows = await Bill.aggregate([
    { $match: { createdAt: { $gte: range.start, $lte: range.end }, status: 'cancelled' } },
    { $project: { _id: 0, billNumber: 1, date: '$createdAt', patientName: 1, grandTotal: 1, notes: 1 } },
    { $sort: { date: 1 } },
  ]);
  return {
    columns: [
      { key: 'billNumber', label: 'Bill No', type: 'text' },
      { key: 'date', label: 'Date', type: 'datetime' },
      { key: 'patientName', label: 'Patient', type: 'text' },
      { key: 'grandTotal', label: 'Amount', type: 'currency' },
      { key: 'notes', label: 'Reason / Notes', type: 'text' },
    ],
    rows,
    summary: [
      { label: 'Cancelled Bills', value: rows.length, type: 'number' },
      { label: 'Cancelled Value', value: sum(rows, (r) => r.grandTotal), type: 'currency' },
    ],
  };
}

// GSTR-1 style, rate-wise output tax
async function gstSales(db, range) {
  const Bill = MedicalBillModel(db);
  const rows = await Bill.aggregate([
    { $match: { createdAt: { $gte: range.start, $lte: range.end }, status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    { $group: {
      _id: { $ifNull: ['$items.gstRate', 0] },
      taxable: { $sum: '$items.taxableAmount' },
      cgst: { $sum: '$items.cgstAmount' },
      sgst: { $sum: '$items.sgstAmount' },
      igst: { $sum: '$items.igstAmount' },
      total: { $sum: '$items.total' },
    } },
    { $project: { _id: 0, rate: '$_id', taxable: 1, cgst: 1, sgst: 1, igst: 1, total: 1 } },
    { $sort: { rate: 1 } },
  ]);
  const mapped = rows.map((r) => ({ ...r, rate: `${r.rate}%` }));
  return {
    columns: [
      { key: 'rate', label: 'GST Rate', type: 'text' },
      { key: 'taxable', label: 'Taxable Value', type: 'currency' },
      { key: 'cgst', label: 'CGST', type: 'currency' },
      { key: 'sgst', label: 'SGST', type: 'currency' },
      { key: 'igst', label: 'IGST', type: 'currency' },
      { key: 'total', label: 'Total', type: 'currency' },
    ],
    rows: mapped,
    summary: [
      { label: 'Total Taxable', value: sum(rows, (r) => r.taxable), type: 'currency' },
      { label: 'Total CGST', value: sum(rows, (r) => r.cgst), type: 'currency' },
      { label: 'Total SGST', value: sum(rows, (r) => r.sgst), type: 'currency' },
      { label: 'Total IGST', value: sum(rows, (r) => r.igst), type: 'currency' },
      { label: 'Total Invoice Value', value: sum(rows, (r) => r.total), type: 'currency' },
    ],
  };
}

/* ============================================================================
   4. PHARMACY / INVENTORY
============================================================================ */

async function currentStock(db) {
  const Item = ItemMasterModel(db);
  const rows = await Item.aggregate([
    { $match: { isActive: { $ne: false } } },
    { $project: {
      _id: 0, itemId: 1, name: 1, categoryName: 1, unit: 1,
      currentStock: 1, reorderLevel: 1, sellingPrice: 1, mrp: 1,
    } },
    { $sort: { name: 1 } },
  ]);
  return {
    columns: [
      { key: 'itemId', label: 'Item ID', type: 'text' },
      { key: 'name', label: 'Item', type: 'text' },
      { key: 'categoryName', label: 'Category', type: 'text' },
      { key: 'unit', label: 'Unit', type: 'text' },
      { key: 'currentStock', label: 'Stock', type: 'number' },
      { key: 'mrp', label: 'MRP', type: 'currency' },
    ],
    rows,
    summary: [{ label: 'Total Items', value: rows.length, type: 'number' }],
  };
}

async function batchExpiry(db) {
  const Item = ItemMasterModel(db);
  const rows = await Item.aggregate([
    { $unwind: '$batches' },
    { $project: {
      _id: 0, item: '$name', batch: '$batches.batchNumber',
      mfg: '$batches.mfgDate', expiry: '$batches.expiryDate',
      qty: '$batches.quantity', mrp: '$batches.mrp', rack: '$batches.rackNumber',
    } },
    { $sort: { expiry: 1 } },
  ]);
  return {
    columns: [
      { key: 'item', label: 'Item', type: 'text' },
      { key: 'batch', label: 'Batch', type: 'text' },
      { key: 'mfg', label: 'Mfg', type: 'date' },
      { key: 'expiry', label: 'Expiry', type: 'date' },
      { key: 'qty', label: 'Qty', type: 'number' },
      { key: 'mrp', label: 'MRP', type: 'currency' },
      { key: 'rack', label: 'Rack', type: 'text' },
    ],
    rows,
  };
}

function nearExpiryFactory(days) {
  return async function nearExpiry(db) {
    const Item = ItemMasterModel(db);
    const now = new Date();
    const limit = new Date(now); limit.setDate(limit.getDate() + days);
    const rows = await Item.aggregate([
      { $unwind: '$batches' },
      { $match: { 'batches.expiryDate': { $gte: now, $lte: limit }, 'batches.quantity': { $gt: 0 } } },
      { $project: {
        _id: 0, item: '$name', batch: '$batches.batchNumber',
        expiry: '$batches.expiryDate', qty: '$batches.quantity',
        value: { $multiply: ['$batches.quantity', { $ifNull: ['$batches.purchasePrice', 0] }] },
      } },
      { $sort: { expiry: 1 } },
    ]);
    return {
      columns: [
        { key: 'item', label: 'Item', type: 'text' },
        { key: 'batch', label: 'Batch', type: 'text' },
        { key: 'expiry', label: 'Expiry', type: 'date' },
        { key: 'qty', label: 'Qty', type: 'number' },
        { key: 'value', label: 'Stock Value', type: 'currency' },
      ],
      rows,
      summary: [{ label: `Value expiring in ${days} days`, value: sum(rows, (r) => r.value), type: 'currency' }],
    };
  };
}

async function expiredStock(db) {
  const Item = ItemMasterModel(db);
  const now = new Date();
  const rows = await Item.aggregate([
    { $unwind: '$batches' },
    { $match: { 'batches.expiryDate': { $lt: now }, 'batches.quantity': { $gt: 0 } } },
    { $project: {
      _id: 0, item: '$name', batch: '$batches.batchNumber',
      expiry: '$batches.expiryDate', qty: '$batches.quantity',
      value: { $multiply: ['$batches.quantity', { $ifNull: ['$batches.purchasePrice', 0] }] },
    } },
    { $sort: { expiry: 1 } },
  ]);
  return {
    columns: [
      { key: 'item', label: 'Item', type: 'text' },
      { key: 'batch', label: 'Batch', type: 'text' },
      { key: 'expiry', label: 'Expired On', type: 'date' },
      { key: 'qty', label: 'Qty', type: 'number' },
      { key: 'value', label: 'Write-off Value', type: 'currency' },
    ],
    rows,
    summary: [{ label: 'Total Write-off Value', value: sum(rows, (r) => r.value), type: 'currency' }],
  };
}

async function lowStock(db) {
  const Item = ItemMasterModel(db);
  const rows = await Item.aggregate([
    { $match: { $expr: { $lte: ['$currentStock', { $ifNull: ['$reorderLevel', 0] }] }, isActive: { $ne: false } } },
    { $project: {
      _id: 0, itemId: 1, name: 1, categoryName: 1,
      currentStock: 1, reorderLevel: 1, reorderQuantity: 1,
    } },
    { $sort: { currentStock: 1 } },
  ]);
  return {
    columns: [
      { key: 'itemId', label: 'Item ID', type: 'text' },
      { key: 'name', label: 'Item', type: 'text' },
      { key: 'categoryName', label: 'Category', type: 'text' },
      { key: 'currentStock', label: 'In Stock', type: 'number' },
      { key: 'reorderLevel', label: 'Reorder Level', type: 'number' },
      { key: 'reorderQuantity', label: 'Suggested Order', type: 'number' },
    ],
    rows,
    summary: [{ label: 'Items Below Reorder', value: rows.length, type: 'number' }],
  };
}

async function stockValuation(db) {
  const Item = ItemMasterModel(db);
  const rows = await Item.aggregate([
    { $match: { isActive: { $ne: false } } },
    { $project: {
      _id: 0, itemId: 1, name: 1, currentStock: 1,
      purchasePrice: 1, mrp: 1,
      costValue: { $multiply: ['$currentStock', { $ifNull: ['$purchasePrice', 0] }] },
      mrpValue: { $multiply: ['$currentStock', { $ifNull: ['$mrp', 0] }] },
    } },
    { $sort: { costValue: -1 } },
  ]);
  return {
    columns: [
      { key: 'itemId', label: 'Item ID', type: 'text' },
      { key: 'name', label: 'Item', type: 'text' },
      { key: 'currentStock', label: 'Stock', type: 'number' },
      { key: 'purchasePrice', label: 'Cost/Unit', type: 'currency' },
      { key: 'costValue', label: 'Cost Value', type: 'currency' },
      { key: 'mrpValue', label: 'MRP Value', type: 'currency' },
    ],
    rows,
    summary: [
      { label: 'Total Cost Value', value: sum(rows, (r) => r.costValue), type: 'currency' },
      { label: 'Total MRP Value', value: sum(rows, (r) => r.mrpValue), type: 'currency' },
    ],
  };
}

async function stockMovement(db, range) {
  const Trx = StockTransactionModel(db);
  const rows = await Trx.aggregate([
    { $match: { date: { $gte: range.start, $lte: range.end } } },
    { $project: {
      _id: 0, date: 1, transactionId: 1, itemName: 1, batchNumber: 1,
      transactionType: 1, quantity: 1, previousStock: 1, newStock: 1,
      totalAmount: 1, performedBy: 1,
    } },
    { $sort: { date: 1 } },
  ]);
  return {
    columns: [
      { key: 'date', label: 'Date', type: 'datetime' },
      { key: 'transactionId', label: 'Txn ID', type: 'text' },
      { key: 'itemName', label: 'Item', type: 'text' },
      { key: 'transactionType', label: 'Type', type: 'text' },
      { key: 'quantity', label: 'Qty', type: 'number' },
      { key: 'previousStock', label: 'Prev', type: 'number' },
      { key: 'newStock', label: 'New', type: 'number' },
      { key: 'totalAmount', label: 'Value', type: 'currency' },
      { key: 'performedBy', label: 'By', type: 'text' },
    ],
    rows,
    summary: [{ label: 'Total Transactions', value: rows.length, type: 'number' }],
  };
}

/* ============================================================================
   5. PURCHASE / PROCUREMENT
============================================================================ */

async function poRegister(db, range) {
  const PO = PurchaseOrderModel(db);
  const rows = await PO.aggregate([
    { $match: { createdAt: { $gte: range.start, $lte: range.end } } },
    { $project: {
      _id: 0, poNumber: 1, date: '$createdAt', vendorName: 1,
      items: { $size: { $ifNull: ['$items', []] } },
      subTotal: 1, taxAmount: 1, grandTotal: 1, status: 1, receivedAt: 1,
    } },
    { $sort: { date: 1 } },
  ]);
  return {
    columns: [
      { key: 'poNumber', label: 'PO No', type: 'text' },
      { key: 'date', label: 'Date', type: 'datetime' },
      { key: 'vendorName', label: 'Vendor', type: 'text' },
      { key: 'items', label: 'Items', type: 'number' },
      { key: 'subTotal', label: 'Sub Total', type: 'currency' },
      { key: 'taxAmount', label: 'GST', type: 'currency' },
      { key: 'grandTotal', label: 'Grand Total', type: 'currency' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    rows,
    summary: [
      { label: 'Total POs', value: rows.length, type: 'number' },
      { label: 'Total Value', value: sum(rows, (r) => r.grandTotal), type: 'currency' },
    ],
  };
}

async function supplierWisePurchase(db, range) {
  const PO = PurchaseOrderModel(db);
  const rows = await PO.aggregate([
    { $match: { createdAt: { $gte: range.start, $lte: range.end }, status: { $ne: 'cancelled' } } },
    { $group: { _id: { $ifNull: ['$vendorName', 'Unknown'] }, orders: { $sum: 1 }, value: { $sum: '$grandTotal' }, gst: { $sum: '$gstAmount' } } },
    { $project: { _id: 0, vendor: '$_id', orders: 1, gst: 1, value: 1 } },
    { $sort: { value: -1 } },
  ]);
  return {
    columns: [
      { key: 'vendor', label: 'Vendor', type: 'text' },
      { key: 'orders', label: 'Orders', type: 'number' },
      { key: 'gst', label: 'Input GST', type: 'currency' },
      { key: 'value', label: 'Total Purchase', type: 'currency' },
    ],
    rows,
    summary: [{ label: 'Total Purchase', value: sum(rows, (r) => r.value), type: 'currency' }],
  };
}

// GSTR-3B input tax credit, rate-wise
async function gstPurchase(db, range) {
  const PO = PurchaseOrderModel(db);
  const rows = await PO.aggregate([
    { $match: { createdAt: { $gte: range.start, $lte: range.end }, status: 'received' } },
    { $unwind: '$items' },
    { $group: {
      _id: { $ifNull: ['$items.gstRate', 0] },
      taxable: { $sum: '$items.taxableAmount' },
      cgst: { $sum: '$items.cgstAmount' },
      sgst: { $sum: '$items.sgstAmount' },
      igst: { $sum: '$items.igstAmount' },
      total: { $sum: '$items.total' },
    } },
    { $project: { _id: 0, rate: '$_id', taxable: 1, cgst: 1, sgst: 1, igst: 1, total: 1 } },
    { $sort: { rate: 1 } },
  ]);
  const mapped = rows.map((r) => ({ ...r, rate: `${r.rate}%` }));
  return {
    columns: [
      { key: 'rate', label: 'GST Rate', type: 'text' },
      { key: 'taxable', label: 'Taxable Value', type: 'currency' },
      { key: 'cgst', label: 'CGST (ITC)', type: 'currency' },
      { key: 'sgst', label: 'SGST (ITC)', type: 'currency' },
      { key: 'igst', label: 'IGST (ITC)', type: 'currency' },
      { key: 'total', label: 'Total', type: 'currency' },
    ],
    rows: mapped,
    summary: [
      { label: 'Total Taxable', value: sum(rows, (r) => r.taxable), type: 'currency' },
      { label: 'Total ITC (CGST+SGST+IGST)', value: sum(rows, (r) => r.cgst + r.sgst + r.igst), type: 'currency' },
    ],
  };
}

async function pendingPO(db) {
  const PO = PurchaseOrderModel(db);
  const rows = await PO.aggregate([
    { $match: { status: 'draft' } },
    { $project: { _id: 0, poNumber: 1, date: '$createdAt', vendorName: 1, grandTotal: 1, status: 1 } },
    { $sort: { date: 1 } },
  ]);
  return {
    columns: [
      { key: 'poNumber', label: 'PO No', type: 'text' },
      { key: 'date', label: 'Raised On', type: 'datetime' },
      { key: 'vendorName', label: 'Vendor', type: 'text' },
      { key: 'grandTotal', label: 'Value', type: 'currency' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    rows,
    summary: [{ label: 'Pending POs', value: rows.length, type: 'number' }],
  };
}

async function payables(db, range) {
  // Approximation: received POs grouped by vendor (no payment-tracking field in model yet)
  const PO = PurchaseOrderModel(db);
  const rows = await PO.aggregate([
    { $match: { status: 'received', createdAt: { $gte: range.start, $lte: range.end } } },
    { $group: { _id: { $ifNull: ['$vendorName', 'Unknown'] }, orders: { $sum: 1 }, payable: { $sum: '$grandTotal' } } },
    { $project: { _id: 0, vendor: '$_id', orders: 1, payable: 1 } },
    { $sort: { payable: -1 } },
  ]);
  return {
    columns: [
      { key: 'vendor', label: 'Vendor', type: 'text' },
      { key: 'orders', label: 'Received Orders', type: 'number' },
      { key: 'payable', label: 'Amount Payable', type: 'currency' },
    ],
    rows,
    summary: [{ label: 'Total Payable', value: sum(rows, (r) => r.payable), type: 'currency' }],
    note: 'Based on received POs. Add a payment/settlement field to track partial payments precisely.',
  };
}

/* ============================================================================
   6. FINANCIAL
============================================================================ */

async function plSummary(db, range) {
  const Bill = MedicalBillModel(db);
  const PO = PurchaseOrderModel(db);
  const [billAgg] = await Bill.aggregate([
    { $match: { createdAt: { $gte: range.start, $lte: range.end }, status: { $ne: 'cancelled' } } },
    { $group: { _id: null, revenue: { $sum: '$grandTotal' }, tax: { $sum: '$gstAmount' } } },
  ]);
  const [poAgg] = await PO.aggregate([
    { $match: { createdAt: { $gte: range.start, $lte: range.end }, status: 'received' } },
    { $group: { _id: null, purchases: { $sum: '$grandTotal' } } },
  ]);
  const revenue = billAgg?.revenue || 0;
  const purchases = poAgg?.purchases || 0;
  const gross = revenue - purchases;
  const rows = [
    { line: 'Total Revenue (sales)', amount: revenue },
    { line: 'Total Purchases (received)', amount: purchases },
    { line: 'Gross Margin', amount: gross },
  ];
  return {
    columns: [
      { key: 'line', label: 'Particulars', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'currency' },
    ],
    rows,
    summary: [{ label: 'Gross Margin', value: gross, type: 'currency' }],
    note: 'Simplified P&L: revenue from bills minus received-PO purchase value. Excludes expenses/salaries unless modelled.',
  };
}

/* ============================================================================
   REGISTRY
============================================================================ */

const REPORTS = {
  // 1. Patient / OPD
  'daily-visits': { title: 'Daily Token & Visit List', category: 'Patient / OPD', generate: dailyVisits },
  'new-vs-returning': { title: 'New vs Returning Patients', category: 'Patient / OPD', generate: newVsReturning },
  'doctor-load': { title: 'Doctor-wise Patient Load', category: 'Patient / OPD', generate: doctorLoad },
  'department-count': { title: 'Department-wise Patient Count', category: 'Patient / OPD', generate: departmentCount },
  'footfall-hourly': { title: 'Footfall by Hour', category: 'Patient / OPD', generate: footfallHourly },
  'patient-demographics': { title: 'Patient Demographics', category: 'Patient / OPD', generate: patientDemographics },
  'patient-register': { title: 'Patient Register (Medico-Legal)', category: 'Patient / OPD', govt: true, generate: patientRegister },
  'patient-visit-history': { title: 'Patient Visit History', category: 'Patient / OPD', params: ['patientId'], generate: patientVisitHistory },

  // 2. Clinical / Prescription
  'prescriptions-summary': { title: 'Prescriptions per Day / Doctor', category: 'Clinical', generate: prescriptionsSummary },
  'most-prescribed': { title: 'Most Prescribed Medicines', category: 'Clinical', generate: mostPrescribed },
  'schedule-h1-register': { title: 'Schedule H1 Prescription Register', category: 'Clinical', govt: true, generate: scheduleH1 },
  'schedule-x-register': { title: 'Schedule X / Narcotic Register', category: 'Clinical', govt: true, generate: scheduleX },
  'antibiotic-usage': { title: 'Antibiotic Usage Report', category: 'Clinical', generate: antibioticUsage },

  // 3. Billing & Revenue
  'daily-collection': { title: 'Daily Collection Summary (Cash/Card/UPI)', category: 'Billing', generate: dailyCollection },
  'bill-register': { title: 'Bill-wise Sales Register', category: 'Billing', govt: true, generate: billRegister },
  'item-wise-sales': { title: 'Item-wise Sales', category: 'Billing', generate: itemWiseSales },
  'payment-mode-split': { title: 'Payment Mode Split', category: 'Billing', generate: paymentModeSplit },
  'discounts': { title: 'Discounts Given Report', category: 'Billing', generate: discountsReport },
  'cancelled-bills': { title: 'Cancelled / Returned Bills', category: 'Billing', generate: cancelledBills },
  'gst-sales': { title: 'GST Sales Report (GSTR-1)', category: 'Billing', govt: true, generate: gstSales },

  // 4. Pharmacy / Inventory
  'current-stock': { title: 'Current Stock on Hand', category: 'Inventory', generate: currentStock },
  'batch-expiry': { title: 'Batch-wise & Expiry-wise Stock', category: 'Inventory', govt: true, generate: batchExpiry },
  'near-expiry-30': { title: 'Near-Expiry Stock (30 days)', category: 'Inventory', generate: nearExpiryFactory(30) },
  'near-expiry-60': { title: 'Near-Expiry Stock (60 days)', category: 'Inventory', generate: nearExpiryFactory(60) },
  'near-expiry-90': { title: 'Near-Expiry Stock (90 days)', category: 'Inventory', generate: nearExpiryFactory(90) },
  'expired-stock': { title: 'Expired Stock / Write-off', category: 'Inventory', govt: true, generate: expiredStock },
  'low-stock': { title: 'Low-Stock / Reorder Report', category: 'Inventory', generate: lowStock },
  'stock-valuation': { title: 'Stock Valuation (Cost & MRP)', category: 'Inventory', generate: stockValuation },
  'stock-movement': { title: 'Stock Movement', category: 'Inventory', generate: stockMovement },

  // 5. Purchase / Procurement
  'po-register': { title: 'Purchase Order Register', category: 'Purchase', generate: poRegister },
  'supplier-wise-purchase': { title: 'Supplier-wise Purchase', category: 'Purchase', generate: supplierWisePurchase },
  'gst-purchase': { title: 'GST Purchase Report (ITC / GSTR-3B)', category: 'Purchase', govt: true, generate: gstPurchase },
  'pending-po': { title: 'Pending / Partial POs', category: 'Purchase', generate: pendingPO },
  'payables': { title: 'Supplier Payment Dues (Payables)', category: 'Purchase', generate: payables },

  // 6. Financial
  'pl-summary': { title: 'Profit & Loss Summary', category: 'Financial', generate: plSummary },
};

/* ============================================================================
   CONTROLLER ENDPOINTS
============================================================================ */

// GET /reports  -> list of available reports (for building a UI menu)
exports.listReports = async (req, res) => {
  const grouped = {};
  Object.entries(REPORTS).forEach(([key, r]) => {
    (grouped[r.category] ||= []).push({
      key, title: r.title, govt: !!r.govt, params: r.params || [],
    });
  });
  res.json({ success: true, categories: grouped, formats: ['pdf', 'excel', 'csv', 'word'] });
};

// GET /reports/:key            -> JSON data (preview)
// GET /reports/:key?format=pdf -> file download (pdf|excel|csv|word)
exports.runReport = async (req, res) => {
  try {
    const def = REPORTS[req.params.key];
    if (!def) return res.status(404).json({ success: false, message: `Unknown report: ${req.params.key}` });

    const range = getDateRange(req.query);
    const result = await def.generate(req.tenantDb, range, req.query);

    const report = {
      title: def.title,
      subtitle: range.label,
      columns: result.columns,
      rows: result.rows,
      summary: result.summary || [],
      note: result.note,
    };

    const format = (req.query.format || '').toLowerCase();
    if (!format || format === 'json') {
      return res.json({
        success: true,
        report: {
          key: req.params.key, title: def.title, category: def.category,
          range: range.label, ...report,
        },
      });
    }

    const { buffer, contentType, filename } = await exportReport(report, format);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.REPORTS = REPORTS;