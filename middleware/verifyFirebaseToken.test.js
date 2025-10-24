const { verifyFirebaseToken, verifyAdmin } = require('./verifyFirebaseToken');

// Mock the Firebase Admin SDK
jest.mock('../firebaseAdmin', () => ({
  auth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn()
  })
}));

describe('Firebase Token Verification Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    next = jest.fn();
  });

  describe('verifyFirebaseToken', () => {
    it('should return 401 if no authorization header is present', async () => {
      await verifyFirebaseToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith({ error: 'Unauthorized - No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if authorization header does not start with Bearer', async () => {
      req.headers.authorization = 'InvalidToken';
      await verifyFirebaseToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith({ error: 'Unauthorized - No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if token is valid', async () => {
      req.headers.authorization = 'Bearer valid-token';
      const mockDecodedUser = { uid: 'user123' };
      require('../firebaseAdmin').auth().verifyIdToken.mockResolvedValue(mockDecodedUser);
      
      await verifyFirebaseToken(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(mockDecodedUser);
    });

    it('should return 403 if token is invalid', async () => {
      req.headers.authorization = 'Bearer invalid-token';
      require('../firebaseAdmin').auth().verifyIdToken.mockRejectedValue(new Error('Invalid token'));
      
      await verifyFirebaseToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('verifyAdmin', () => {
    it('should return 401 if no authorization header is present', async () => {
      await verifyAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith({ error: 'Unauthorized - No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not admin', async () => {
      req.headers.authorization = 'Bearer valid-token';
      const mockDecodedUser = { uid: 'user123', role: 'user' };
      require('../firebaseAdmin').auth().verifyIdToken.mockResolvedValue(mockDecodedUser);
      
      await verifyAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith({ error: 'Forbidden - Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if user is admin', async () => {
      req.headers.authorization = 'Bearer valid-token';
      const mockDecodedUser = { uid: 'user123', role: 'admin' };
      require('../firebaseAdmin').auth().verifyIdToken.mockResolvedValue(mockDecodedUser);
      
      await verifyAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(mockDecodedUser);
    });
  });
});