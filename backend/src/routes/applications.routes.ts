import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { validate, validateQuery, validateParams } from '../middlewares/validation';
import { Environment } from '@prisma/client';
import Joi from 'joi';

const router = Router();

// Validation schemas
const createApplicationSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  displayName: Joi.string().required().min(1).max(255),
  description: Joi.string().optional().allow('').max(1000),
  environment: Joi.string().valid(...Object.values(Environment)).required(),
  healthUrl: Joi.string().uri().required().max(500),
  teamId: Joi.string().uuid().optional(),
});

const updateApplicationSchema = createApplicationSchema.fork(
  ['name', 'displayName', 'environment', 'healthUrl'],
  (schema) => schema.optional(),
);

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  environment: Joi.string().valid(...Object.values(Environment)).optional(),
  isActive: Joi.boolean().optional(),
  search: Joi.string().optional().allow(''),
});

const paramSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

// Get application statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const totalApplications = await prisma.application.count();
    // This can be expanded later to include health data
    const stats = {
      totalApplications,
      healthyCount: 0, // Placeholder
      warningCount: 0, // Placeholder
      errorCount: 0,   // Placeholder
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve application statistics' });
  }
});

// Get all applications
router.get('/', validateQuery(querySchema), async (req: Request, res: Response) => {
  try {
    const { page, limit, environment, isActive, search } = req.query as any;
    const where: any = {};

    if (environment) where.environment = environment;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { displayName: { contains: search } },
      ];
    }

    const [applications, total] = await prisma.$transaction([
      prisma.application.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          team: true,
        },
      }),
      prisma.application.count({ where }),
    ]);

    res.json({
      applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get application by ID
router.get('/:id', validateParams(paramSchema), async (req: Request, res: Response) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, displayName: true } },
        lastModifier: { select: { id: true, displayName: true } },
        team: true,
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json(application);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// Create application
router.post('/', validate(createApplicationSchema), async (req: Request, res: Response) => {
  try {
    // Note: In a real app, createdBy and lastModifiedBy would come from the authenticated user
    const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (!adminUser) {
      return res.status(500).json({ error: 'No admin user found to assign ownership' });
    }

    const application = await prisma.application.create({
      data: {
        ...req.body,
        createdBy: adminUser.id,
        lastModifiedBy: adminUser.id,
      },
    });

    res.status(201).json(application);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Application name already exists' });
    }
    res.status(500).json({ error: 'Failed to create application' });
  }
});

// Update application
router.put('/:id', validateParams(paramSchema), validate(updateApplicationSchema), async (req: Request, res: Response) => {
  try {
    const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (!adminUser) {
      return res.status(500).json({ error: 'No admin user found to assign ownership' });
    }

    const application = await prisma.application.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        lastModifiedBy: adminUser.id,
      },
    });

    res.json(application);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Application name already exists' });
    }
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// Delete application
router.delete('/:id', validateParams(paramSchema), async (req: Request, res: Response) => {
  try {
    await prisma.application.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

export default router;
