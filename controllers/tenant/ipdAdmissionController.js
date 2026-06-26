const PatientModel = require('../../models/tenant/Patient');
const WardModel = require('../../models/tenant/Ward');
const RoomModel = require('../../models/tenant/Room');
const BedModel = require('../../models/tenant/Bed');
const IpdAdmissionModel = require('../../models/tenant/IpdAdmission');

const ACTIVE_IPD_STATUSES = [
  'admitted',
  'discharge_summary_prepared',
  'settlement_pending',
  'settled',
];

const registerIpdModels = (tenantDb) => {
  const Patient = PatientModel(tenantDb);
  const Ward = WardModel(tenantDb);
  const Room = RoomModel(tenantDb);
  const Bed = BedModel(tenantDb);
  const IpdAdmission = IpdAdmissionModel(tenantDb);

  return {
    Patient,
    Ward,
    Room,
    Bed,
    IpdAdmission,
  };
};

const safePopulateAdmission = (query) => {
  return query
    .populate('patient', 'patientId name phone age gender address')
    .populate('ward', 'wardId name wardType speciality floor')
    .populate('room', 'roomId roomNumber name roomType floor')
    .populate('bed', 'bedId bedNumber bedType status dailyCharge');
};

const calculateCharges = (charges = []) => {
  return charges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0);
};

const generateSubNo = (prefix, count) => {
  return `${prefix}-${String(count + 1).padStart(5, '0')}`;
};

/* ──────────────────────────────────────────────────────────────
   GET /ipd/admissions
────────────────────────────────────────────────────────────── */

exports.getAdmissions = async (req, res) => {
  try {
    const { IpdAdmission } = registerIpdModels(req.tenantDb);

    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      ward,
      room,
      bed,
      patient,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { admissionNo: { $regex: search, $options: 'i' } },
        { patientId: { $regex: search, $options: 'i' } },
        { patientName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { tokenNumber: { $regex: search, $options: 'i' } },
        { wardName: { $regex: search, $options: 'i' } },
        { roomNumber: { $regex: search, $options: 'i' } },
        { bedNumber: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) filter.status = status;
    if (ward) filter.ward = ward;
    if (room) filter.room = room;
    if (bed) filter.bed = bed;
    if (patient) filter.patient = patient;

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.min(100, Math.max(Number(limit), 1));
    const skip = (pageNumber - 1) * limitNumber;

    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'admissionDate',
      'expectedDischargeDate',
      'patientName',
      'admissionNo',
      'status',
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const sort = {};
    sort[safeSortBy] = sortOrder === 'asc' ? 1 : -1;

    const [admissions, total] = await Promise.all([
      safePopulateAdmission(
        IpdAdmission.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limitNumber)
      ).lean(),

      IpdAdmission.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: admissions,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IPD admissions',
      error: error.message,
    });
  }
};

/* ──────────────────────────────────────────────────────────────
   GET /ipd/admissions/:id
────────────────────────────────────────────────────────────── */

exports.getAdmissionById = async (req, res) => {
  try {
    const { IpdAdmission } = registerIpdModels(req.tenantDb);

    const admission = await safePopulateAdmission(
      IpdAdmission.findById(req.params.id)
    );

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found',
      });
    }

    res.json({
      success: true,
      data: admission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admission',
      error: error.message,
    });
  }
};

/* ──────────────────────────────────────────────────────────────
   POST /ipd/admissions/allocate
────────────────────────────────────────────────────────────── */

exports.allocateBed = async (req, res) => {
  try {
    const { Patient, Bed, IpdAdmission } = registerIpdModels(req.tenantDb);

    const {
      patient: patientId,
      visitId,
      bed: bedId,
      admissionType = 'ipd',
      admissionDate,
      expectedDischargeDate,
      reasonForAdmission = '',
      consultantDoctor,
      consultantDoctorName = '',
    } = req.body;

    if (!patientId || !bedId) {
      return res.status(400).json({
        success: false,
        message: 'Patient and bed are required',
      });
    }

    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    const existingAdmission = await IpdAdmission.findOne({
      patient: patientId,
      status: { $in: ACTIVE_IPD_STATUSES },
    });

    if (existingAdmission) {
      return res.status(400).json({
        success: false,
        message: 'Patient already has an active IPD admission',
      });
    }

    let selectedVisit = null;

    if (visitId) {
      selectedVisit = patient.visits.id(visitId);

      if (!selectedVisit) {
        return res.status(404).json({
          success: false,
          message: 'Patient visit not found',
        });
      }
    } else if (patient.visits?.length) {
      selectedVisit = patient.visits[patient.visits.length - 1];
    }

    const bed = await Bed.findById(bedId)
      .populate('ward', 'wardId name wardType speciality floor')
      .populate('room', 'roomId roomNumber name roomType floor');

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found',
      });
    }

    if (bed.status === 'occupied') {
      return res.status(400).json({
        success: false,
        message: 'Selected bed is already occupied',
      });
    }

    if (bed.status === 'maintenance' || bed.status === 'inactive') {
      return res.status(400).json({
        success: false,
        message: `Selected bed is ${bed.status}`,
      });
    }

    const admission = await IpdAdmission.create({
      patient: patient._id,
      patientId: patient.patientId,
      patientName: patient.name,
      phone: patient.phone,
      age: patient.age,
      gender: patient.gender,

      visitId: selectedVisit?._id,
      tokenNumber: selectedVisit?.tokenNumber || '',
      departmentName: selectedVisit?.departmentName || '',
      doctorName: selectedVisit?.doctorName || '',

      ward: bed.ward?._id || bed.ward,
      wardName: bed.ward?.name || '',

      room: bed.room?._id || bed.room,
      roomNumber: bed.room?.roomNumber || '',

      bed: bed._id,
      bedNumber: bed.bedNumber,

      admissionType,
      admissionDate: admissionDate || new Date(),
      expectedDischargeDate,
      reasonForAdmission,
      consultantDoctor,
      consultantDoctorName,

      status: 'admitted',
      isActive: true,
    });

    await Bed.findByIdAndUpdate(bed._id, {
      status: 'occupied',
      isActive: true,
    });

    const populatedAdmission = await safePopulateAdmission(
      IpdAdmission.findById(admission._id)
    );

    res.status(201).json({
      success: true,
      message: 'Bed allocated successfully',
      data: populatedAdmission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to allocate bed',
      error: error.message,
    });
  }
};

/* ──────────────────────────────────────────────────────────────
   PATCH /ipd/admissions/:id/discharge
   Legacy-safe discharge endpoint.
   It does NOT release bed directly.
────────────────────────────────────────────────────────────── */

exports.dischargeAdmission = async (req, res) => {
  try {
    const { IpdAdmission } = registerIpdModels(req.tenantDb);

    const admission = await IpdAdmission.findById(req.params.id);

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found',
      });
    }

    admission.dischargeSummaryDetails = {
      summaryDate: new Date(),
      finalDiagnosis: req.body.finalDiagnosis || '',
      hospitalCourse: req.body.hospitalCourse || '',
      treatmentGiven: req.body.treatmentGiven || '',
      conditionOnDischarge: req.body.conditionOnDischarge || '',
      dischargeAdvice: req.body.dischargeAdvice || req.body.dischargeAdvice || '',
      followUpDate: req.body.followUpDate || undefined,
      preparedByName: req.body.preparedByName || '',
      status: 'completed',
    };

    admission.dischargeSummary = req.body.dischargeSummary || '';
    admission.dischargeAdvice = req.body.dischargeAdvice || '';
    admission.status = 'settlement_pending';

    await admission.save();

    const populatedAdmission = await safePopulateAdmission(
      IpdAdmission.findById(admission._id)
    );

    res.json({
      success: true,
      message: 'Discharge summary saved. Final settlement is pending.',
      data: populatedAdmission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to save discharge details',
      error: error.message,
    });
  }
};

/* ──────────────────────────────────────────────────────────────
   POST /ipd/admissions/:id/vitals
────────────────────────────────────────────────────────────── */

exports.addVitals = async (req, res) => {
  try {
    const { IpdAdmission } = registerIpdModels(req.tenantDb);

    const admission = await IpdAdmission.findById(req.params.id);

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found',
      });
    }

    if (admission.status !== 'admitted') {
      return res.status(400).json({
        success: false,
        message: 'Vitals can be added only for admitted patients',
      });
    }

    admission.vitals.push({
      recordedAt: req.body.recordedAt || new Date(),
      temperature: req.body.temperature || '',
      pulse: req.body.pulse || '',
      respiratoryRate: req.body.respiratoryRate || '',
      spo2: req.body.spo2 || '',
      bpSystolic: req.body.bpSystolic || '',
      bpDiastolic: req.body.bpDiastolic || '',
      bloodSugar: req.body.bloodSugar || '',
      height: req.body.height || '',
      weight: req.body.weight || '',
      bmi: req.body.bmi || '',
      painScore: req.body.painScore || '',
      notes: req.body.notes || '',
      recordedBy: req.body.recordedBy,
      recordedByName: req.body.recordedByName || '',
    });

    await admission.save();

    res.json({
      success: true,
      message: 'Vitals added successfully',
      data: admission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add vitals',
      error: error.message,
    });
  }
};

/* ──────────────────────────────────────────────────────────────
   POST /ipd/admissions/:id/nursing-notes
────────────────────────────────────────────────────────────── */

exports.addNursingNote = async (req, res) => {
  try {
    const { IpdAdmission } = registerIpdModels(req.tenantDb);

    const admission = await IpdAdmission.findById(req.params.id);

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found',
      });
    }

    if (!req.body.note) {
      return res.status(400).json({
        success: false,
        message: 'Nursing note is required',
      });
    }

    admission.nursingNotes.push({
      noteDate: req.body.noteDate || new Date(),
      shift: req.body.shift || 'general',
      category: req.body.category || 'general',
      note: req.body.note,
      actionTaken: req.body.actionTaken || '',
      recordedBy: req.body.recordedBy,
      recordedByName: req.body.recordedByName || '',
    });

    await admission.save();

    res.json({
      success: true,
      message: 'Nursing note added successfully',
      data: admission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add nursing note',
      error: error.message,
    });
  }
};

/* ──────────────────────────────────────────────────────────────
   POST /ipd/admissions/:id/doctor-rounds
────────────────────────────────────────────────────────────── */

exports.addDoctorRound = async (req, res) => {
  try {
    const { IpdAdmission } = registerIpdModels(req.tenantDb);

    const admission = await IpdAdmission.findById(req.params.id);

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found',
      });
    }

    admission.doctorRounds.push({
      roundDate: req.body.roundDate || new Date(),
      doctor: req.body.doctor,
      doctorName:
        req.body.doctorName ||
        admission.consultantDoctorName ||
        admission.doctorName ||
        '',
      complaints: req.body.complaints || '',
      examination: req.body.examination || '',
      diagnosis: req.body.diagnosis || '',
      treatmentPlan: req.body.treatmentPlan || '',
      medicationChanges: req.body.medicationChanges || '',
      investigationAdvice: req.body.investigationAdvice || '',
      followUpInstructions: req.body.followUpInstructions || '',
      nextRoundDate: req.body.nextRoundDate,
    });

    await admission.save();

    res.json({
      success: true,
      message: 'Doctor round added successfully',
      data: admission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add doctor round',
      error: error.message,
    });
  }
};

/* ──────────────────────────────────────────────────────────────
   POST /ipd/admissions/:id/lab-orders
────────────────────────────────────────────────────────────── */

exports.addLabOrder = async (req, res) => {
  try {
    const { IpdAdmission } = registerIpdModels(req.tenantDb);

    const admission = await IpdAdmission.findById(req.params.id);

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found',
      });
    }

    if (!req.body.tests?.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one lab test is required',
      });
    }

    const tests = req.body.tests.map((test) => ({
      testName: test.testName,
      testCode: test.testCode || '',
      sampleType: test.sampleType || '',
      priority: test.priority || 'routine',
      amount: Number(test.amount || 0),
      status: 'ordered',
    }));

    const totalAmount = tests.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const orderNo = generateSubNo('LAB', admission.labOrders.length);

    admission.labOrders.push({
      orderNo,
      orderedAt: req.body.orderedAt || new Date(),
      orderedByName: req.body.orderedByName || '',
      tests,
      totalAmount,
      status: 'ordered',
      notes: req.body.notes || '',
    });

    admission.charges.push({
      chargeType: 'lab',
      description: `Lab Order ${orderNo}`,
      quantity: 1,
      rate: totalAmount,
      amount: totalAmount,
      referenceType: 'lab_order',
      addedByName: req.body.orderedByName || '',
    });

    await admission.save();

    res.json({
      success: true,
      message: 'Lab order added successfully',
      data: admission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add lab order',
      error: error.message,
    });
  }
};

/* ──────────────────────────────────────────────────────────────
   POST /ipd/admissions/:id/medicine-issues
────────────────────────────────────────────────────────────── */

exports.issueMedicine = async (req, res) => {
  try {
    const { IpdAdmission } = registerIpdModels(req.tenantDb);

    const admission = await IpdAdmission.findById(req.params.id);

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found',
      });
    }

    if (!req.body.items?.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one medicine is required',
      });
    }

    let ItemMaster = null;

    try {
      ItemMaster = req.tenantDb.model('ItemMaster');
    } catch (_) {
      ItemMaster = null;
    }

    const issueItems = [];

    for (const row of req.body.items) {
      const quantity = Number(row.quantity || 1);
      const price = Number(row.price || 0);
      const amount = quantity * price;

      let itemData = null;

      if (ItemMaster && row.item) {
        itemData = await ItemMaster.findById(row.item);

        if (itemData && itemData.currentStock !== undefined) {
          const currentStock = Number(itemData.currentStock || 0);

          if (currentStock < quantity) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock for ${itemData.name}`,
            });
          }

          itemData.currentStock = currentStock - quantity;
          await itemData.save();
        }
      }

      issueItems.push({
        item: row.item || undefined,
        itemId: row.itemId || itemData?.itemId || '',
        itemName: row.itemName || itemData?.name || '',
        batchNo: row.batchNo || '',
        quantity,
        unit: row.unit || itemData?.unit || '',
        price,
        amount,
      });
    }

    const totalAmount = issueItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const issueNo = generateSubNo('MED', admission.medicineIssues.length);

    admission.medicineIssues.push({
      issueNo,
      issuedAt: req.body.issuedAt || new Date(),
      issuedByName: req.body.issuedByName || '',
      items: issueItems,
      totalAmount,
      status: 'issued',
      notes: req.body.notes || '',
    });

    admission.charges.push({
      chargeType: 'medicine',
      description: `Medicine Issue ${issueNo}`,
      quantity: 1,
      rate: totalAmount,
      amount: totalAmount,
      referenceType: 'medicine_issue',
      addedByName: req.body.issuedByName || '',
    });

    await admission.save();

    res.json({
      success: true,
      message: 'Medicine issued successfully',
      data: admission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to issue medicine',
      error: error.message,
    });
  }
};

/* ──────────────────────────────────────────────────────────────
   POST /ipd/admissions/:id/charges
────────────────────────────────────────────────────────────── */

exports.addIpdCharge = async (req, res) => {
  try {
    const { IpdAdmission } = registerIpdModels(req.tenantDb);

    const admission = await IpdAdmission.findById(req.params.id);

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found',
      });
    }

    if (!req.body.description) {
      return res.status(400).json({
        success: false,
        message: 'Charge description is required',
      });
    }

    const quantity = Number(req.body.quantity || 1);
    const rate = Number(req.body.rate || 0);
    const amount =
      req.body.amount !== undefined
        ? Number(req.body.amount || 0)
        : quantity * rate;

    admission.charges.push({
      chargeDate: req.body.chargeDate || new Date(),
      chargeType: req.body.chargeType || 'misc',
      description: req.body.description,
      quantity,
      rate,
      amount,
      addedByName: req.body.addedByName || '',
    });

    await admission.save();

    res.json({
      success: true,
      message: 'IPD charge added successfully',
      data: admission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add IPD charge',
      error: error.message,
    });
  }
};

/* ──────────────────────────────────────────────────────────────
   PATCH /ipd/admissions/:id/discharge-summary
────────────────────────────────────────────────────────────── */

exports.saveDischargeSummary = async (req, res) => {
  try {
    const { IpdAdmission } = registerIpdModels(req.tenantDb);

    const admission = await IpdAdmission.findById(req.params.id);

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found',
      });
    }

    admission.dischargeSummaryDetails = {
      summaryDate: req.body.summaryDate || new Date(),
      finalDiagnosis: req.body.finalDiagnosis || '',
      hospitalCourse: req.body.hospitalCourse || '',
      treatmentGiven: req.body.treatmentGiven || '',
      conditionOnDischarge: req.body.conditionOnDischarge || '',
      dischargeAdvice: req.body.dischargeAdvice || '',
      followUpDate: req.body.followUpDate || undefined,
      preparedByName: req.body.preparedByName || '',
      status: req.body.status || 'completed',
    };

    admission.status = 'settlement_pending';

    await admission.save();

    res.json({
      success: true,
      message: 'Discharge summary saved successfully',
      data: admission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to save discharge summary',
      error: error.message,
    });
  }
};

/* ──────────────────────────────────────────────────────────────
   PATCH /ipd/admissions/:id/final-settlement
────────────────────────────────────────────────────────────── */

exports.saveFinalSettlement = async (req, res) => {
  try {
    const { IpdAdmission } = registerIpdModels(req.tenantDb);

    const admission = await IpdAdmission.findById(req.params.id);

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found',
      });
    }

    const totalCharges = calculateCharges(admission.charges);
    const discount = Number(req.body.discount || 0);
    const advancePaid = Number(req.body.advancePaid || 0);
    const paidAmount = Number(req.body.paidAmount || 0);

    const balanceAmount = totalCharges - discount - advancePaid - paidAmount;

    let settlementStatus = 'pending';

    if (balanceAmount <= 0) {
      settlementStatus = 'settled';
    } else if (paidAmount > 0 || advancePaid > 0) {
      settlementStatus = 'partial';
    }

    admission.finalSettlement = {
      totalCharges,
      discount,
      advancePaid,
      paidAmount,
      balanceAmount,
      paymentMode: req.body.paymentMode || 'cash',
      paymentReference: req.body.paymentReference || '',
      settledAt: settlementStatus === 'settled' ? new Date() : undefined,
      settledByName: req.body.settledByName || '',
      status: settlementStatus,
    };

    admission.status =
      settlementStatus === 'settled' ? 'settled' : 'settlement_pending';

    await admission.save();

    res.json({
      success: true,
      message: 'Final settlement saved successfully',
      data: admission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to save final settlement',
      error: error.message,
    });
  }
};

/* ──────────────────────────────────────────────────────────────
   PATCH /ipd/admissions/:id/bed-release
────────────────────────────────────────────────────────────── */

exports.releaseBed = async (req, res) => {
  try {
    const { Bed, IpdAdmission } = registerIpdModels(req.tenantDb);

    const admission = await IpdAdmission.findById(req.params.id);

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found',
      });
    }

    if (admission.finalSettlement?.status !== 'settled') {
      return res.status(400).json({
        success: false,
        message: 'Final settlement must be completed before bed release',
      });
    }

    await Bed.findByIdAndUpdate(admission.bed, {
      status: 'available',
      isActive: true,
    });

    admission.status = 'bed_released';
    admission.isActive = false;
    admission.bedReleasedAt = new Date();
    admission.bedReleasedByName = req.body.bedReleasedByName || '';
    admission.dischargeDate = req.body.dischargeDate || new Date();

    await admission.save();

    res.json({
      success: true,
      message: 'Bed released successfully',
      data: admission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to release bed',
      error: error.message,
    });
  }
};

/* ──────────────────────────────────────────────────────────────
   GET /ipd/admissions/reports/summary
────────────────────────────────────────────────────────────── */

exports.getIpdReports = async (req, res) => {
  try {
    const { Bed, IpdAdmission } = registerIpdModels(req.tenantDb);

    const { from, to } = req.query;

    const dateFilter = {};

    if (from || to) {
      dateFilter.admissionDate = {};

      if (from) dateFilter.admissionDate.$gte = new Date(from);
      if (to) dateFilter.admissionDate.$lte = new Date(to);
    }

    const [
      totalAdmissions,
      activeAdmissions,
      dischargedAdmissions,
      settledAdmissions,
      totalBeds,
      occupiedBeds,
      totalRevenueData,
      wardWiseAdmissions,
    ] = await Promise.all([
      IpdAdmission.countDocuments(dateFilter),

      IpdAdmission.countDocuments({
        ...dateFilter,
        status: { $in: ACTIVE_IPD_STATUSES },
      }),

      IpdAdmission.countDocuments({
        ...dateFilter,
        status: { $in: ['bed_released', 'discharged'] },
      }),

      IpdAdmission.countDocuments({
        ...dateFilter,
        'finalSettlement.status': 'settled',
      }),

      Bed.countDocuments({}),

      Bed.countDocuments({ status: 'occupied' }),

      IpdAdmission.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalCharges: { $sum: '$finalSettlement.totalCharges' },
            totalPaid: { $sum: '$finalSettlement.paidAmount' },
            totalBalance: { $sum: '$finalSettlement.balanceAmount' },
          },
        },
      ]),

      IpdAdmission.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$wardName',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
    ]);

    const revenue = totalRevenueData[0] || {
      totalCharges: 0,
      totalPaid: 0,
      totalBalance: 0,
    };

    res.json({
      success: true,
      data: {
        totalAdmissions,
        activeAdmissions,
        dischargedAdmissions,
        settledAdmissions,
        bedOccupancy: {
          totalBeds,
          occupiedBeds,
          availableBeds: totalBeds - occupiedBeds,
          occupancyPercentage: totalBeds
            ? Math.round((occupiedBeds / totalBeds) * 100)
            : 0,
        },
        revenue,
        wardWiseAdmissions,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IPD reports',
      error: error.message,
    });
  }
};