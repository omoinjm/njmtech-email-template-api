process.env.NODE_ENV = 'test';
process.env.SMTP_HOST = '';

import request from 'supertest';
import { api } from '../api/index';

describe('GET /', () => {
  it('responds with 200 and HTML', async () => {
    const res = await request(api).get('/');
    expect(res.status).toEqual(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});

describe('POST /template', () => {
  it('responds with 400 and error when all parameters are missing', async () => {
    const res = await request(api).post('/template').send({});
    expect(res.status).toEqual(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('missingParams');
    expect(res.body.missingParams).toContain('template_name');
    expect(res.body.missingParams).toContain('first_name');
    expect(res.body.missingParams).toContain('last_name');
  });

  it('responds with 400 when only partial params are provided', async () => {
    const res = await request(api).post('/template').send({ template_name: 'thank_you' });
    expect(res.status).toEqual(400);
    expect(res.body.missingParams).toContain('first_name');
    expect(res.body.missingParams).toContain('last_name');
  });

  it('responds with 200 and rendered HTML for thank_you template', async () => {
    const res = await request(api)
      .post('/template')
      .send({ template_name: 'thank_you', first_name: 'John', last_name: 'Doe' });
    expect(res.status).toEqual(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('John Doe');
  });

  it('responds with 200 and renders contact_notification with extra vars', async () => {
    const res = await request(api)
      .post('/template')
      .send({
        template_name: 'contact_notification',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        subject: 'Hello there',
        message: 'This is a test message',
      });
    expect(res.status).toEqual(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('John Doe');
    expect(res.text).toContain('john@example.com');
    expect(res.text).toContain('Hello there');
    expect(res.text).toContain('This is a test message');
  });

  it('responds with 200 and renders contact_confirmation with extra vars', async () => {
    const res = await request(api)
      .post('/template')
      .send({
        template_name: 'contact_confirmation',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        subject: 'Inquiry',
        message: 'Looking forward to hearing from you',
      });
    expect(res.status).toEqual(200);
    expect(res.text).toContain('Jane');
    expect(res.text).toContain('Looking forward to hearing from you');
  });

  it('responds with 200 and renders subscribe_welcome', async () => {
    const res = await request(api)
      .post('/template')
      .send({
        template_name: 'subscribe_welcome',
        first_name: 'Alex',
        last_name: 'Taylor',
        email: 'alex@example.com',
      });
    expect(res.status).toEqual(200);
    expect(res.text).toContain("You're on the list");
  });

  it('responds with 404 when template does not exist', async () => {
    const res = await request(api)
      .post('/template')
      .send({ template_name: 'nonexistent', first_name: 'John', last_name: 'Doe' });
    expect(res.status).toEqual(404);
    expect(res.body).toHaveProperty('error');
  });

  it('renders the style-and-grace thank_you template with order details', async () => {
    const res = await request(api)
      .post('/template')
      .send({
        client: 'style-and-grace',
        template_name: 'thank_you',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        order_number: 'SG-1042',
        order_date: '18 May 2026',
        payment_status: 'Paid',
        shipping_method: 'Courier Guy - Standard',
        estimated_delivery: '21-23 May 2026',
        subtotal: 'R1,150.00',
        shipping: 'R99.00',
        discount: 'R0.00',
        tax: 'Included',
        total: 'R1,249.00',
        shipping_address: '12 Palm Avenue\nSandton\nJohannesburg',
        billing_address: '12 Palm Avenue\nSandton\nJohannesburg',
        site_url: 'https://styleandgrace.co.za',
        order_items: [
          {
            name: 'Satin Wrap Dress',
            variant: 'Color: Burgundy / Size: M',
            quantity: 1,
            subtotal: 'R899.00',
          },
          {
            name: 'Classic Heel Sandals',
            variant: 'Color: Nude / Size: 6',
            quantity: 1,
            subtotal: 'R350.00',
          },
        ],
      });

    expect(res.status).toEqual(200);
    expect(res.text).toContain('Thanks for your order!');
    expect(res.text).toContain('SG-1042');
    expect(res.text).toContain('Satin Wrap Dress');
    expect(res.text).toContain('Classic Heel Sandals');
    expect(res.text).toContain('R1,249.00');
    expect(res.text).toContain('https://styleandgrace.co.za');
  });
});
