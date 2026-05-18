import request from 'supertest';
import { api } from '../api/index';

jest.setTimeout(20000);

describe('GET /', () => {
  it('responds with 200 and HTML', async () => {
    const res = await request(api).get('/');
    expect(res.status).toEqual(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});

describe('GET /openapi.json', () => {
  it('responds with the OpenAPI document', async () => {
    const res = await request(api).get('/openapi.json');
    expect(res.status).toEqual(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toHaveProperty('openapi', '3.1.0');
    expect(res.body.paths).toHaveProperty('/template');
    expect(res.body.paths).toHaveProperty('/preview/{client}/{template}');
  });
});

describe('GET /docs', () => {
  it('responds with the docs UI', async () => {
    const res = await request(api).get('/docs');
    expect(res.status).toEqual(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('swagger-ui');
  });
});

describe('GET /preview/:template', () => {
  it('renders the default preview route without a client parameter', async () => {
    const res = await request(api).get('/preview/thank_you');
    expect(res.status).toEqual(200);
    expect(res.text).toContain('NJMTech');
  });

  it('renders a client-specific preview when client is supplied', async () => {
    const res = await request(api).get('/preview/thank_you').query({ client: 'style-and-grace' });
    expect(res.status).toEqual(200);
    expect(res.text).toContain('Style &amp; Grace');
  });
});

describe('GET /preview/:client/:template', () => {
  it('renders a client-specific preview from the namespaced route', async () => {
    const res = await request(api).get('/preview/style-and-grace/thank_you');
    expect(res.status).toEqual(200);
    expect(res.text).toContain('Style &amp; Grace');
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
    expect(res.text).toContain('John'); // template greets by first name
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

  it('renders a client-specific template when client is supplied', async () => {
    const res = await request(api)
      .post('/template')
      .send({
        client: 'style-and-grace',
        template_name: 'thank_you',
        first_name: 'John',
        last_name: 'Doe',
      });

    expect(res.status).toEqual(200);
    expect(res.text).toContain('Style &amp; Grace');
  });
});
