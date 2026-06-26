// server/controllers/tenant/patientController.js
const PatientModel = require('../../models/tenant/Patient');

exports.getPatients = async (req, res) => {
  try {
    const Patient = PatientModel(req.tenantDb);

    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const search     = (req.query.search     || '').trim();
    const sortBy     =  req.query.sortBy     || 'createdAt';
    const sortOrder  =  req.query.sortOrder  === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'patientId', 'phone'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    let query = {};
    
    if (search) {
      const searchStr = String(search);
      
      // For phone numbers stored as numbers, we need to convert in the query
      query = {
        $or: [
          { patientId: { $regex: searchStr, $options: 'i' } },
          { name: { $regex: searchStr, $options: 'i' } },
          // Convert phone number to string before regex matching
          { 
            $expr: {
              $regexMatch: {
                input: { $toString: "$phone" },
                regex: searchStr,
                options: "i"
              }
            }
          }
        ]
      };
    }

    const [patients, total] = await Promise.all([
      Patient.find(query)
        .select('patientId name phone age gender address isActive visits createdAt updatedAt')
        .sort({ [safeSortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),

      Patient.countDocuments(query),
    ]);

    // Convert phone numbers to strings for frontend
    const enriched = patients.map((p) => {
      const { visits, ...rest } = p;
      const visitArr = visits || [];
      const last = visitArr[visitArr.length - 1] || null;
      return {
        ...rest,
        // Convert phone from number to string
        phone: p.phone ? String(p.phone) : '',
        visitCount: visitArr.length,
        latestVisit: last
          ? {
              _id: last._id,
              departmentName: last.departmentName,
              doctorName: last.doctorName,
              tokenNumber: last.tokenNumber,
              status: last.status,
              visitDate: last.visitDate,
            }
          : null,
      };
    });

    res.json({
      success: true,
      data: enriched,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error in getPatients:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
/* ──────────────────────────────────────────────────────────────
   GET /patients/:id
   Full document — only called when opening a single patient's
   detail modal. We intentionally skip visits.sourceToken because
   PatientToken may not be registered on the tenant connection in
   all environments. Department and doctor are registered models
   so those populates are safe to keep.
────────────────────────────────────────────────────────────── */
exports.getPatientById = async (req, res) => {
  try {
    const Patient = PatientModel(req.tenantDb);

    // Build a base query without any populate first
    let query = Patient.findById(req.params.id);

    // Only populate models that are guaranteed to be registered
    // on the tenant connection. PatientToken is NOT populated here
    // because it throws "Schema hasn't been registered" on some
    // tenant DBs. If you need it, register PatientTokenModel(req.tenantDb)
    // before this route runs, or add it to your tenantMiddleware.
    try {
      // Test if Department is registered before populating
      req.tenantDb.model('Department');
      query = query.populate('visits.department', 'name code');
    } catch (_) { /* Department not registered — skip */ }

    try {
      // Test if Staff is registered before populating
      req.tenantDb.model('Staff');
      query = query.populate('visits.doctor', 'name email role');
    } catch (_) { /* Staff not registered — skip */ }

    const patient = await query;

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    res.json({ success: true, data: patient });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ──────────────────────────────────────────────────────────────
   PATCH /patients/:id
────────────────────────────────────────────────────────────── */
exports.updatePatient = async (req, res) => {
  try {
    const Patient = PatientModel(req.tenantDb);

    const allowedFields = {};
    ['name', 'phone', 'age', 'gender', 'address', 'isActive'].forEach((field) => {
      if (req.body[field] !== undefined) allowedFields[field] = req.body[field];
    });

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      allowedFields,
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    res.json({ success: true, message: 'Patient updated successfully', data: patient });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ──────────────────────────────────────────────────────────────
   PUT /patients/:patientId/visits/:visitId
────────────────────────────────────────────────────────────── */
exports.updatePatientVisit = async (req, res) => {
  try {
    const Patient = PatientModel(req.tenantDb);

    const { patientId, visitId } = req.params;
    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const visit = patient.visits.id(visitId);
    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }

    if (req.body.name    !== undefined) patient.name    = req.body.name;
    if (req.body.phone   !== undefined) patient.phone   = req.body.phone;
    if (req.body.age     !== undefined) patient.age     = req.body.age;
    if (req.body.gender  !== undefined) patient.gender  = req.body.gender;
    if (req.body.address !== undefined) patient.address = req.body.address;

    visit.habits = { ...(visit.habits || {}), ...(req.body.habits || {}) };
    visit.generalEnquiry  = { ...(visit.generalEnquiry  || {}), ...(req.body.generalEnquiry  || {}) };
    visit.departmentForm  = { ...(visit.departmentForm   || {}), ...(req.body.departmentForm  || {}) };

    if (req.body.status !== undefined) visit.status = req.body.status;

    patient.markModified('visits');
    await patient.save();

    res.json({ success: true, message: 'Patient visit updated successfully', data: patient });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ──────────────────────────────────────────────────────────────
   PATCH /patients/:patientId/visits/:visitId/complete
────────────────────────────────────────────────────────────── */
exports.completePatientVisit = async (req, res) => {
  try {
    const Patient = PatientModel(req.tenantDb);

    const { patientId, visitId } = req.params;
    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const visit = patient.visits.id(visitId);
    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }

    visit.status = 'completed';
    patient.markModified('visits');
    await patient.save();

    res.json({ success: true, message: 'Patient visit completed successfully', data: patient });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};