'use strict';

// A page belongs to the account that created it; pages without a userID (legacy) have no owner.
exports.isOwner = (request, page) => {
  return request.auth.isAuthenticated && page.userID != null && page.userID === request.auth.credentials.id;
};
