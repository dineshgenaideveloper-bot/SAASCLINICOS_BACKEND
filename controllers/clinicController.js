// server/controllers/clinicController.js

const Clinic = require('../models/Clinic');
const User = require('../models/User');
const { getTenantDB } = require('../config/tenantDb');
const mongoose = require('mongoose');

const getTenantDatabaseObject = async (tenantId) => {
  const tenantDbName = `clinicos_${tenantId}`;
  let db = null;

  try {
    const tenantConnection = await getTenantDB(tenantId);

    if (tenantConnection?.db) {
      db = tenantConnection.db;
    } else if (tenantConnection?.client) {
      db = tenantConnection.client.db(tenantDbName);
    }
  } catch (error) {
    console.warn(`Tenant DB helper fallback for ${tenantId}:`, error.message);
  }

  if (!db && mongoose.connection?.client) {
    db = mongoose.connection.client.db(tenantDbName);
  }

  if (!db) {
    throw new Error('Unable to access tenant database object');
  }

  return { db, tenantDbName };
};

// GET all clinics with pagination
exports.getClinics = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      isActive,
      type,
      city,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tenantId: { $regex: search, $options: 'i' } },
        { 'owner.name': { $regex: search, $options: 'i' } },
        { 'owner.email': { $regex: search, $options: 'i' } },
      ];
    }

    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true';
    }

    if (type) {
      filter.type = type;
    }

    if (city) {
      filter['address.city'] = { $regex: `^${city}$`, $options: 'i' };
    }

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [clinics, total] = await Promise.all([
      Clinic.find(filter)
        .populate('owner', 'name email role')
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Clinic.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: clinics,
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
      message: 'Failed to fetch clinics',
      error: error.message,
    });
  }
};

// GET clinic by ID
exports.getClinicById = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id)
      .populate('owner', 'name email role')
      .lean();

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    res.json({
      success: true,
      data: clinic,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clinic',
      error: error.message,
    });
  }
};

// GET clinic users
exports.getClinicUsers = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id);
    
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    const users = await User.find({ 
      tenantId: clinic.tenantId 
    }).select('name email role tenantId isActive createdAt').lean();

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clinic users',
      error: error.message,
    });
  }
};

// UPDATE clinic
exports.updateClinic = async (req, res) => {
  try {
    const clinic = await Clinic.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('owner', 'name email role');

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    res.json({
      success: true,
      data: clinic,
      message: 'Clinic updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update clinic',
      error: error.message,
    });
  }
};

// DELETE clinic with users and tenant storage
exports.deleteClinic = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id);

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    const tenantId = clinic.tenantId;
    let storageCleared = false;
    let tenantDbName = `clinicos_${tenantId}`;

    // Clear tenant database first. If storage cleanup fails, keep the clinic/user records intact.
    try {
      const tenantDb = await getTenantDatabaseObject(tenantId);
      tenantDbName = tenantDb.tenantDbName;
      await tenantDb.db.dropDatabase();
      storageCleared = true;
    } catch (storageError) {
      console.error('Delete clinic storage cleanup error:', storageError);
      return res.status(500).json({
        success: false,
        message: 'Failed to clear clinic storage. Clinic was not deleted.',
        error: storageError.message,
      });
    }

    const usersResult = await User.deleteMany({ tenantId });
    await Clinic.findByIdAndDelete(clinic._id);

    res.json({
      success: true,
      message: 'Clinic, clinic users, and clinic storage deleted successfully',
      data: {
        clinicId: clinic._id,
        clinicName: clinic.name,
        tenantId,
        tenantDbName,
        deletedUsers: usersResult.deletedCount || 0,
        storageCleared,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete clinic',
      error: error.message,
    });
  }
};

// UPDATE clinic user status
exports.updateClinicUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isActive },
      { new: true, runValidators: true }
    ).select('name email role tenantId isActive');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message,
    });
  }
};

// DELETE clinic user
exports.deleteClinicUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId).select(
      'name email role tenantId isActive'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
      message: 'Clinic user deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete clinic user',
      error: error.message,
    });
  }
};

// GET clinic database storage information - CORRECTED VERSION
exports.getClinicStorageInfo = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id);

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    const tenantId = clinic.tenantId;
    const tenantDbName = `clinicos_${tenantId}`;
    
    try {
      const tenantConnection = await getTenantDB(tenantId);
      
      if (!tenantConnection) {
        return res.status(404).json({
          success: false,
          message: 'Tenant database connection not found',
        });
      }

      let db = tenantConnection.db;
      
      if (!db && tenantConnection.client) {
        db = tenantConnection.client.db(tenantDbName);
      }
      
      if (!db) {
        db = mongoose.connection.client.db(tenantDbName);
      }
      
      if (!db) {
        return res.status(500).json({
          success: false,
          message: 'Unable to access database object',
        });
      }

      const collections = await db.listCollections().toArray();
      const collectionStats = [];
      let totalDataSize = 0;
      let totalStorageSize = 0;
      let totalIndexSize = 0;
      let totalDocuments = 0;

      for (const collection of collections) {
        try {
          const stats = await db.command({ collStats: collection.name });
          
          // MongoDB stats explanation:
          // - stats.size: Actual data size (sum of all document sizes)
          // - stats.storageSize: Storage size including padding, deleted space
          // - stats.totalIndexSize: Total size of all indexes
          // - stats.avgObjSize: Average document size in bytes
          
          const dataSizeInMB = (stats.size || 0) / (1024 * 1024);
          const storageSizeInMB = (stats.storageSize || 0) / (1024 * 1024);
          const indexSizeInMB = (stats.totalIndexSize || 0) / (1024 * 1024);
          const avgDocSizeInKB = (stats.avgObjSize || 0) / 1024;
          
          collectionStats.push({
            name: collection.name,
            documents: stats.count || 0,
            dataSize: parseFloat(dataSizeInMB.toFixed(2)),
            storageSize: parseFloat(storageSizeInMB.toFixed(2)),
            indexSize: parseFloat(indexSizeInMB.toFixed(2)),
            avgDocSize: parseFloat(avgDocSizeInKB.toFixed(2)),
            // Backward compatibility fields
            size: parseFloat(storageSizeInMB.toFixed(2)),
            totalIndexSize: stats.totalIndexSize || 0
          });
          
          totalDataSize += dataSizeInMB;
          totalStorageSize += storageSizeInMB;
          totalIndexSize += indexSizeInMB;
          totalDocuments += stats.count || 0;
          
          console.log(`${collection.name}: ${stats.count} docs | Data: ${dataSizeInMB.toFixed(2)}MB | Storage: ${storageSizeInMB.toFixed(2)}MB | Index: ${indexSizeInMB.toFixed(2)}MB`);
        } catch (err) {
          console.error(`Error getting stats for ${collection.name}:`, err.message);
          collectionStats.push({
            name: collection.name,
            documents: 0,
            dataSize: 0,
            storageSize: 0,
            indexSize: 0,
            avgDocSize: 0,
            error: err.message
          });
        }
      }

      collectionStats.sort((a, b) => b.storageSize - a.storageSize);

      res.json({
        success: true,
        data: {
          databaseName: tenantDbName,
          tenantId: tenantId,
          totalDataSize: totalDataSize.toFixed(2) + ' MB',
          totalStorageSize: totalStorageSize.toFixed(2) + ' MB',
          totalIndexSize: totalIndexSize.toFixed(2) + ' MB',
          totalSize: totalStorageSize.toFixed(2) + ' MB',
          totalSizeBytes: Math.round(totalStorageSize * 1024 * 1024),
          totalCollections: collections.length,
          totalDocuments: totalDocuments,
          collections: collectionStats,
          lastUpdated: new Date(),
          explanation: {
            dataSize: "Actual size of your documents (what you see in Compass as 'Data Size')",
            storageSize: "Space used on disk including compression and padding (what you see as 'Storage Size')",
            indexSize: "Space used by database indexes",
            total: "Total storage on disk = Storage Size + Index Size"
          }
        }
      });
    } catch (dbError) {
      console.error('Tenant DB connection error:', dbError);
      res.status(500).json({
        success: false,
        message: 'Failed to connect to tenant database',
        error: dbError.message,
      });
    }
  } catch (error) {
    console.error('Get storage info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage information',
      error: error.message,
    });
  }
};


// Clear full tenant database storage without deleting clinic/users
exports.clearClinicStorage = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id);

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    const tenantId = clinic.tenantId;
    const { db, tenantDbName } = await getTenantDatabaseObject(tenantId);

    const collections = await db.listCollections().toArray();
    let totalDocuments = 0;

    for (const collection of collections) {
      try {
        totalDocuments += await db.collection(collection.name).countDocuments();
      } catch (error) {
        console.warn(`Failed to count ${collection.name}:`, error.message);
      }
    }

    await db.dropDatabase();

    res.json({
      success: true,
      message: 'Clinic storage cleared successfully',
      data: {
        clinicId: clinic._id,
        clinicName: clinic.name,
        tenantId,
        tenantDbName,
        collectionsCleared: collections.length,
        documentsDeleted: totalDocuments,
      },
    });
  } catch (error) {
    console.error('Clear clinic storage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear clinic storage',
      error: error.message,
    });
  }
};

// Export collection data to Excel
exports.exportCollectionData = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id);
    
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    const { collectionName } = req.params;
    const tenantId = clinic.tenantId;
    const tenantDbName = `clinicos_${tenantId}`;
    
    const tenantConnection = await getTenantDB(tenantId);
    let db = tenantConnection.db;
    
    if (!db && tenantConnection.client) {
      db = tenantConnection.client.db(tenantDbName);
    }
    
    if (!db) {
      db = mongoose.connection.client.db(tenantDbName);
    }
    
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Unable to access database object',
      });
    }
    
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found',
      });
    }
    
    // Limit to 10,000 documents for performance
    const documents = await db.collection(collectionName).find({}).limit(10000).toArray();
    
    const processedDocs = documents.map(doc => {
      const newDoc = { ...doc };
      if (newDoc._id) {
        newDoc._id = newDoc._id.toString();
      }
      // Convert nested ObjectIds and Dates
      Object.keys(newDoc).forEach(key => {
        if (newDoc[key] && typeof newDoc[key] === 'object' && newDoc[key]._id) {
          newDoc[key]._id = newDoc[key]._id.toString();
        }
        if (newDoc[key] instanceof Date) {
          newDoc[key] = newDoc[key].toISOString();
        }
      });
      return newDoc;
    });
    
    res.json({
      success: true,
      data: processedDocs,
      count: processedDocs.length,
      collectionName: collectionName,
      totalInCollection: documents.length
    });
  } catch (error) {
    console.error('Export collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export collection data',
      error: error.message,
    });
  }
};

// Clear collection (delete all documents)
exports.clearCollection = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id);
    
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    const { collectionName } = req.params;
    const tenantId = clinic.tenantId;
    const tenantDbName = `clinicos_${tenantId}`;
    
    const tenantConnection = await getTenantDB(tenantId);
    let db = tenantConnection.db;
    
    if (!db && tenantConnection.client) {
      db = tenantConnection.client.db(tenantDbName);
    }
    
    if (!db) {
      db = mongoose.connection.client.db(tenantDbName);
    }
    
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Unable to access database object',
      });
    }
    
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found',
      });
    }
    
    const count = await db.collection(collectionName).countDocuments();
    
    if (count === 0) {
      return res.json({
        success: true,
        message: `Collection ${collectionName} is already empty`,
        data: {
          collectionName,
          deletedCount: 0,
          previousCount: count
        }
      });
    }
    
    const result = await db.collection(collectionName).deleteMany({});
    
    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} documents from ${collectionName}`,
      data: {
        collectionName,
        deletedCount: result.deletedCount,
        previousCount: count
      }
    });
  } catch (error) {
    console.error('Clear collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear collection',
      error: error.message,
    });
  }
};

// Get all tenants storage (for super admin)
exports.getAllTenantsStorage = async (req, res) => {
  try {
    const clinics = await Clinic.find({}, 'name tenantId');
    const tenantsData = [];
    
    for (const clinic of clinics) {
      try {
        const tenantConnection = await getTenantDB(clinic.tenantId);
        let db = tenantConnection.db;
        
        if (!db && tenantConnection.client) {
          db = tenantConnection.client.db(`clinicos_${clinic.tenantId}`);
        }
        
        if (!db) {
          db = mongoose.connection.client.db(`clinicos_${clinic.tenantId}`);
        }
        
        if (!db) {
          tenantsData.push({
            clinicId: clinic._id,
            clinicName: clinic.name,
            tenantId: clinic.tenantId,
            error: 'Cannot connect to database'
          });
          continue;
        }
        
        const collections = await db.listCollections().toArray();
        let totalDataSize = 0;
        let totalStorageSize = 0;
        let totalIndexSize = 0;
        let totalDocuments = 0;
        
        for (const collection of collections) {
          try {
            const stats = await db.command({ collStats: collection.name });
            totalDataSize += (stats.size || 0) / (1024 * 1024);
            totalStorageSize += (stats.storageSize || 0) / (1024 * 1024);
            totalIndexSize += (stats.totalIndexSize || 0) / (1024 * 1024);
            totalDocuments += stats.count || 0;
          } catch (err) {
            console.error(`Error getting stats for ${collection.name}:`, err.message);
          }
        }
        
        tenantsData.push({
          clinicId: clinic._id,
          clinicName: clinic.name,
          tenantId: clinic.tenantId,
          totalDataSize: totalDataSize.toFixed(2) + ' MB',
          totalStorageSize: totalStorageSize.toFixed(2) + ' MB',
          totalIndexSize: totalIndexSize.toFixed(2) + ' MB',
          totalSize: totalStorageSize.toFixed(2) + ' MB',
          totalSizeBytes: Math.round(totalStorageSize * 1024 * 1024),
          totalCollections: collections.length,
          totalDocuments: totalDocuments,
        });
      } catch (err) {
        console.error(`Error processing tenant ${clinic.tenantId}:`, err);
        tenantsData.push({
          clinicId: clinic._id,
          clinicName: clinic.name,
          tenantId: clinic.tenantId,
          error: err.message
        });
      }
    }
    
    res.json({
      success: true,
      data: tenantsData
    });
  } catch (error) {
    console.error('Get all tenants storage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenants storage information',
      error: error.message
    });
  }
};