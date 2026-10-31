import { createRemoteJWKSet, jwtVerify } from "jose";

const authBaseUrl = process.env.AUTH_BASE_URL;

if (!authBaseUrl) {
  throw new Error("AUTH_BASE_URL is not configured.");
}

const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", authBaseUrl));

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Token is missing.",
      });
    }

    const token = authHeader.slice(7);

    const { payload } = await jwtVerify(token, jwks, {
      issuer: authBaseUrl,
      audience: authBaseUrl,
      algorithms: ["EdDSA"],
    });

    if (
      !payload.sub ||
      typeof payload.email !== "string" ||
      !payload.email.trim()
    ) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid user information.",
      });
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    };

    next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);

    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or expired token.",
    });
  }
};
