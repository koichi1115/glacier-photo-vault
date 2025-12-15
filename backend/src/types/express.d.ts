import { JwtPayload } from '../services/AuthService';

declare global {
    namespace Express {
        interface User extends JwtPayload { }
    }
}
