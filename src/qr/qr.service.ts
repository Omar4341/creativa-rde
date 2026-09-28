import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../config/app-config.service.js';

export interface QrTokenPayload {
  reg: string;
}

/**
 * QR token service.
 * Token = signed JWT with { reg: registrationId } + unique jti + exp.
 * The jti is stored in registrations.qr_token; the full JWT goes to the user's QR code.
 * The backend is the ONLY verifier — the frontend never validates tokens.
 */
@Injectable()
export class QrService {
  constructor(private readonly config: AppConfigService) {}

  sign(registrationId: string): { token: string; jti: string; expiresAt: Date } {
    const jti = randomUUID();
    const expiresIn = this.config.qrTokenExpiryHours * 3600;
    const token = jwt.sign({ reg: registrationId } satisfies QrTokenPayload, this.config.qrJwtSecret, {
      jwtid: jti,
      expiresIn,
    });
    return { token, jti, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }

  verify(token: string): { registrationId: string; jti: string } {
    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, this.config.qrJwtSecret) as jwt.JwtPayload;
    } catch (err) {
      const expired = err instanceof jwt.TokenExpiredError;
      if (expired) {
        throw new UnprocessableEntityException({ code: 'ATTENDANCE_QR_EXPIRED', message: 'This QR code has expired.' });
      }
      throw new BadRequestException({ code: 'ATTENDANCE_QR_INVALID', message: 'This QR code is invalid.' });
    }
    if (!decoded.reg || !decoded.jti) {
      throw new BadRequestException({ code: 'ATTENDANCE_QR_INVALID', message: 'This QR code is invalid.' });
    }
    return { registrationId: decoded.reg, jti: decoded.jti };
  }
}
