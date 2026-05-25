import psql from "./psql.js";
import tableplus from "./tableplus.js";
import dbeaver from "./dbeaver.js";
import beekeeper from "./beekeeper.js";
import pgadmin from "./pgadmin.js";

// Priority order = auto-pick preference when multiple clients are installed.
// CLI client first (zero config), then macOS-popular GUI, then cross-platform IDEs.
export default [psql, tableplus, dbeaver, beekeeper, pgadmin];
