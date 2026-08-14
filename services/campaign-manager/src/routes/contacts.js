import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import { Contact } from '../models/Contact.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const page = Number(req.query.page || 0);
    const limit = Math.min(Number(req.query.limit || 50), 500);
    const q = req.query.q;
    const filter = { clientId: req.client._id };
    if (q) filter.phone = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const [contacts, total] = await Promise.all([
      Contact.find(filter).skip(page * limit).limit(limit).sort('-createdAt'),
      Contact.countDocuments(filter),
    ]);
    res.json({ contacts, total, page, limit });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const c = await Contact.create({ ...req.body, clientId: req.client._id });
    res.json(c);
  } catch (e) { next(e); }
});

// CSV import. Body: { csv: "phone,firstName,lastName\n+15551234567,Alice,Smith" }
router.post('/bulk', async (req, res, next) => {
  try {
    const { csv } = req.body;
    if (!csv) return res.status(400).json({ error: 'csv body required' });
    const records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
    let upserts = 0, updates = 0, skipped = 0;
    for (const r of records) {
      const phone = (r.phone || r.Phone || r.PHONE || '').toString().trim();
      if (!phone) { skipped++; continue; }
      const doc = {
        clientId: req.client._id,
        phone,
        firstName: r.firstName || r.first_name || r.FirstName || '',
        lastName: r.lastName || r.last_name || r.LastName || '',
        customFields: Object.fromEntries(
          Object.entries(r).filter(([k]) => !['phone','Phone','PHONE','firstName','first_name','FirstName','lastName','last_name','LastName'].includes(k))
        ),
      };
      const result = await Contact.updateOne(
        { clientId: doc.clientId, phone: doc.phone },
        { $set: doc },
        { upsert: true }
      );
      if (result.upsertedCount) upserts++;
      else if (result.modifiedCount) updates++;
    }
    res.json({ upserts, updates, skipped, total: records.length });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Contact.deleteOne({ _id: req.params.id, clientId: req.client._id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export { router as contactRouter };
