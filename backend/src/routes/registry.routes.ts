import express from 'express';
import { applicationRegistryService } from '../services/applicationRegistryService';
import { logger } from '../utils/logger';

const router = express.Router();

// Get all applications
router.get('/', async (req, res) => {
  try {
    const applications = await applicationRegistryService.getApplications();
    res.json(applications);
  } catch (error) {
    logger.error('Failed to get applications', { error });
    res.status(500).json({ error: 'Failed to retrieve applications' });
  }
});

// Get application by ID
router.get('/:id', async (req, res) => {
  try {
    const application = await applicationRegistryService.getApplication(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json(application);
  } catch (error) {
    logger.error('Failed to get application', { error, id: req.params.id });
    res.status(500).json({ error: 'Failed to retrieve application' });
  }
});

// Create new application
router.post('/', async (req, res) => {
  try {
    const applicationData = req.body;
    
    // Validate required fields
    const requiredFields = ['name', 'team', 'namespace', 'health_check_url'];
    for (const field of requiredFields) {
      if (!applicationData[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    const application = await applicationRegistryService.createApplication(applicationData);
    res.status(201).json(application);
  } catch (error) {
    logger.error('Failed to create application', { error, body: req.body });
    res.status(500).json({ error: 'Failed to create application' });
  }
});

// Record health check
router.post('/:id/health', async (req, res) => {
  try {
    const healthCheckData = {
      ...req.body,
      application_id: req.params.id
    };

    await applicationRegistryService.recordHealthCheck(healthCheckData);
    res.status(201).json({ message: 'Health check recorded successfully' });
  } catch (error) {
    logger.error('Failed to record health check', { error, id: req.params.id, body: req.body });
    res.status(500).json({ error: 'Failed to record health check' });
  }
});

export default router;