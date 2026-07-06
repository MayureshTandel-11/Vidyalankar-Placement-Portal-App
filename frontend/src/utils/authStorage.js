const LARGE_FIELD_KEYS = ["profileImage", "avatar", "resume", "certificates", "documents"];

export const sanitizeUserForStorage = (user) => {
  if (!user || typeof user !== "object" || Array.isArray(user)) {
    return user;
  }

  const safeUser = { ...user };

  LARGE_FIELD_KEYS.forEach((key) => {
    delete safeUser[key];
  });

  if (safeUser.studentPhoto && typeof safeUser.studentPhoto === "object" && !Array.isArray(safeUser.studentPhoto)) {
    const { data, contentType, fileName, ...rest } = safeUser.studentPhoto;
    const hasUrl = typeof rest?.url === "string" && rest.url.trim();

    if (hasUrl) {
      safeUser.studentPhoto = { url: rest.url };
    } else {
      delete safeUser.studentPhoto;
    }
  }

  return safeUser;
};

export const sanitizeAuthStateForStorage = (authState) => {
  if (!authState || typeof authState !== "object" || Array.isArray(authState)) {
    return authState;
  }

  if (!authState.user || typeof authState.user !== "object" || Array.isArray(authState.user)) {
    return authState;
  }

  return {
    ...authState,
    user: sanitizeUserForStorage(authState.user),
  };
};
