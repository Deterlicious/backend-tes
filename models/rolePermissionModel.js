const mongoose = require("mongoose");

const rolePermissionSchema = new mongoose.Schema({
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  roleID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
    required: true,
  },
  permissionID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Permission",
    required: true,
    index: true, 
  },
});

// Compound Index Unique: Satu role tidak boleh punya permission yang sama dobel
rolePermissionSchema.index({ roleID: 1, permissionID: 1 }, { unique: true });

module.exports = mongoose.model("RolePermission", rolePermissionSchema);