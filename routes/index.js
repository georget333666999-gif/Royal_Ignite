import adminRoutes, * as adminModules from "./admin/index.js";
import userRoutes, * as userModules from "./user/index.js";

export {
    adminModules,
    userModules,
    adminRoutes,
    userRoutes
};

export default {
    admin: adminModules,
    user: userModules
};
