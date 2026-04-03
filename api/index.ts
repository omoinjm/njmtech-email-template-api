import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import nodemailer from 'nodemailer';
import serverless from 'serverless-http';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const api = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many requests, please try again later.' },
});

api.use(bodyParser.json());
api.use(bodyParser.urlencoded({ extended: true }));
api.set('view engine', 'ejs');
api.set('views', path.join(__dirname, 'views'));

api.get('/', (req: Request, res: Response) => {
  res.render('pages/home', { title: 'Email Template API', isHome: true });
});

if (process.env.NODE_ENV !== 'test') {
  api.use('/template', limiter);
}

api.post('/template', async (req: Request, res: Response, next: NextFunction) => {
  const { template_name, first_name, last_name, email, ...extraVars } = req.body;
  const missingParams: string[] = [];

  if (!template_name) missingParams.push('template_name');
  if (!first_name) missingParams.push('first_name');
  if (!last_name) missingParams.push('last_name');

  if (missingParams.length > 0) {
    return res.status(400).json({ error: 'Missing required parameters', missingParams });
  }

  const displayName = `${first_name} ${last_name}`;
  const senderName = process.env.SENDER_NAME || 'NJMTech';
  const contactEmail = process.env.CONTACT_EMAIL || '';

  let html: string;
  try {
    html = await new Promise<string>((resolve, reject) => {
      res.render(
        `pages/${template_name}`,
        { title: 'Thank You', isHome: false, displayName, senderName, contactEmail, email, ...extraVars },
        (err: Error | null, str: string) => {
          if (err) reject(err);
          else resolve(str);
        }
      );
    });
  } catch {
    return res.status(404).json({ error: `Template '${template_name}' not found` });
  }

  if (email && process.env.SMTP_HOST) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: `"${process.env.FROM_NAME || 'NJMTech'}" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: `Thank you, ${displayName}!`,
        html,
      });
    } catch (err) {
      return next(err);
    }
  }

  res.status(200).send(html);
});

api.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

export { api };
export default serverless(api);

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  api.listen(PORT, () => console.log(`Email Template API running on http://localhost:${PORT}`));
}
