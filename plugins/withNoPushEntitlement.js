// Local notifications only: expo-notifications' autolinked config plugin adds the
// aps-environment (remote push) entitlement, but our provisioning profile has no
// Push Notifications capability and we don't use remote push at all.
// This plugin strips the entitlement after all other plugins have run.
const { withEntitlementsPlist } = require('expo/config-plugins');
module.exports = function withNoPushEntitlement(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
};
