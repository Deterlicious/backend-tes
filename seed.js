require("dotenv").config();
const mongoose = require("mongoose");
const Permission = require("./models/permissionModel");
const Role = require("./models/roleModel");
const Pengguna = require("./models/penggunaModel");
const RolePermission = require("./models/rolePermissionModel");
const Tenant = require("./models/tenantModel"); // Assuming Tenant model exists

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/crud-produk";

const seedData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        // 1. Create Tenant (if not exists)
        let tenant = await Tenant.findOne({ namaToko: "Toko Sejahtera" });
        if (!tenant) {
            tenant = new Tenant({
                namaToko: "Toko Sejahtera",
                alamat: "Jl. Contoh No. 1",
                kontak: "08123456789",
                status: "aktif",
            });
            await tenant.save();
            console.log("Tenant created");
        }
        console.log(`Tenant ID: ${tenant._id}`);

        // 2. Create Permissions
        const permissionsData = [
            { nama: "kelola-pengguna", grup: "Pengguna" },
            { nama: "lihat-pengguna", grup: "Pengguna" },
            { nama: "kelola-role", grup: "Role" },
            { nama: "lihat-role", grup: "Role" },
            { nama: "kelola-transaksi", grup: "Transaksi" },
        ];

        for (const p of permissionsData) {
            const exists = await Permission.findOne({ nama: p.nama });
            if (!exists) {
                await Permission.create(p);
                console.log(`Permission ${p.nama} created`);
            }
        }

        // 3. Create Role (Super Admin)
        let role = await Role.findOne({ namaRole: "Super Admin", tenantID: tenant._id });
        if (!role) {
            role = new Role({
                tenantID: tenant._id,
                namaRole: "Super Admin",
                deskripsi: "Full Access",
            });
            await role.save();
            console.log("Role Super Admin created");
        }

        // 4. Assign All Permissions to Super Admin
        const allPermissions = await Permission.find();
        for (const p of allPermissions) {
            const exists = await RolePermission.findOne({
                roleID: role._id,
                permissionID: p._id,
            });
            if (!exists) {
                await RolePermission.create({
                    tenantID: tenant._id,
                    roleID: role._id,
                    permissionID: p._id,
                });
            }
        }
        console.log("Permissions assigned to Super Admin");

        // 5. Create Admin User
        const adminPin = "123456";
        let admin = await Pengguna.findOne({ nama: "Admin Utama" });

        if (!admin) {
            admin = new Pengguna({
                nama: "Admin Utama",
                pin: adminPin,
                roleID: role._id,
                tenantID: tenant._id,
                status: "aktif",
                tokenVersion: 0,
            });
            await admin.save();
            console.log(`Admin User created. PIN: ${adminPin}`);
        } else {
            console.log("Admin User already exists");
        }

        // 6. Create Kasir Role
        let roleKasir = await Role.findOne({ namaRole: "Kasir", tenantID: tenant._id });
        if (!roleKasir) {
            roleKasir = new Role({
                tenantID: tenant._id,
                namaRole: "Kasir",
                deskripsi: "Melayani Transaksi",
            });
            await roleKasir.save();
            console.log("Role Kasir created");
        }

        // 7. Create & Assign Kasir Permissions
        const pKasir = await Permission.findOne({ nama: "kelola-transaksi" });
        if (pKasir) {
            const existsKasirPerm = await RolePermission.findOne({
                roleID: roleKasir._id,
                permissionID: pKasir._id,
            });
            if (!existsKasirPerm) {
                await RolePermission.create({
                    tenantID: tenant._id,
                    roleID: roleKasir._id,
                    permissionID: pKasir._id,
                });
            }
        }

        // 8. Create Kasir User
        const kasirPin = "111111";
        let kasir = await Pengguna.findOne({ nama: "Budi Kasir" });
        if (!kasir) {
            kasir = new Pengguna({
                nama: "Budi Kasir",
                pin: kasirPin,
                roleID: roleKasir._id,
                tenantID: tenant._id,
                status: "aktif",
                tokenVersion: 0,
            });
            await kasir.save();
            console.log(`Kasir User created. PIN: ${kasirPin}`);
        } else {
            console.log("Kasir User already exists");
        }

        console.log("Seeding completed");
        process.exit(0);
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
};

seedData();
