const mongoose = require("mongoose");

const rolePermissionSchema = new mongoose.Schema({
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true, // Wajib index untuk filtering per tenant
  },
  roleID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
    required: true,
    // Index sudah tercover oleh compound index di bawah (sebagai prefix)
  },
  permissionID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Permission",
    required: true,
    index: true, // Index untuk reverse lookup (Role apa saja yang punya permission X?)
  },
});

// == Compound Index & Unique Constraint ==
// 1. Mencegah duplikasi: Satu role tidak boleh memiliki permission yang sama lebih dari satu kali.
// 2. Mempercepat query: .find({ roleID: "..." })
rolePermissionSchema.index({ roleID: 1, permissionID: 1 }, { unique: true });

module.exports = mongoose.model("RolePermission", rolePermissionSchema);