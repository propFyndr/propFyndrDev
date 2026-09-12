import fs from 'fs';
import path from 'path';

import chatRouter from '../src/routes/chat';
import sessionsRouter from '../src/routes/sessions';
import projectsRouter from '../src/routes/projects';
import savedRouter from '../src/routes/saved';
import leadsRouter from '../src/routes/leads';
import adminRouter from '../src/routes/admin';
import buildersRouter from '../src/routes/builders';
import marketComparisonRouter from '../src/routes/marketComparison';
import priceAlertsRouter from '../src/routes/priceAlerts';
import aqiRouter from '../src/routes/aqi';
import commuteRouter from '../src/routes/commute';
import builderReputationRouter from '../src/routes/builderReputation';
import transcribeRouter from '../src/routes/transcribe';
import documentsRouter from '../src/routes/documents';
import registryPricesRouter from '../src/routes/registryPrices';
import builderRegistrationRouter from '../src/routes/builderRegistration';
import builderApplicationsRouter from '../src/routes/builderApplications';
import analyticsRouter from '../src/routes/analytics';
import shareRouter from '../src/routes/share';
import adminIntelligenceRouter from '../src/routes/admin-intelligence';
import blogRouter from '../src/routes/blog';
import adminTeamRouter from '../src/routes/adminTeam';
import adminPartnersRouter from '../src/routes/adminPartners';
import { adminEmailRouter } from '../src/routes/adminEmail';
import { adminPromotionsRouter } from '../src/routes/adminPromotions';
import { betaRouter } from '../src/routes/betaObservability';
import partnerRegistrationRouter from '../src/routes/partnerRegistration';
import portalRouter from '../src/routes/portal';

const swaggerPath = path.resolve(__dirname, '../../swagger.json');
const swagger = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));

const routes: { method: string; path: string }[] = [];

const map = {
  chatRouter: '/api/v1/chat',
  sessionsRouter: '/api/v1/sessions',
  blogRouter: '/api/v1/blog',
  projectsRouter: '/api/v1/projects',
  savedRouter: '/api/v1/saved',
  leadsRouter: '/api/v1/leads',
  adminRouter: '/api/v1/admin',
  adminPromotionsRouter: '/api/v1/admin/promotions',
  adminTeamRouter: '/api/v1/admin/team',
  adminPartnersRouter: '/api/v1/admin/channel-partners',
  adminEmailRouter: '/api/v1/admin/email',
  betaRouter: '/api/v1/admin/beta',
  partnerRegistrationRouter: '/api/v1/partner-registration',
  portalRouter: '/api/v1/portal',
  buildersRouter: '/api/v1/builders',
  marketComparisonRouter: '/api/v1/market-comparison',
  priceAlertsRouter: '/api/v1/price-alerts',
  aqiRouter: '/api/v1/aqi',
  commuteRouter: '/api/v1/commute',
  builderReputationRouter: '/api/v1/builder-reputation',
  transcribeRouter: '/api/v1/transcribe',
  documentsRouter: '/api/v1/documents',
  registryPricesRouter: '/api/v1/registry-prices',
  builderRegistrationRouter: '/api/v1/builder-registration',
  builderApplicationsRouter: '/api/v1/builder-applications',
  analyticsRouter: '/api/v1/analytics',
  shareRouter: '/api/v1/share',
  adminIntelligenceRouter: '/api/v1/admin/intelligence',
};

function extract(router: any, basePath: string) {
  router.stack.forEach((layer: any) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods);
      methods.forEach((method) => {
        routes.push({ method: method.toLowerCase(), path: basePath + layer.route.path });
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      const match = layer.regexp.source.match(/\^\/([a-zA-Z0-9_\-]+)\//);
      let nestedPath = basePath;
      if (match) nestedPath += '/' + match[1];
      extract(layer.handle, nestedPath);
    }
  });
}

extract(chatRouter, map.chatRouter);
extract(sessionsRouter, map.sessionsRouter);
extract(blogRouter, map.blogRouter);
extract(projectsRouter, map.projectsRouter);
extract(savedRouter, map.savedRouter);
extract(leadsRouter, map.leadsRouter);
extract(adminRouter, map.adminRouter);
extract(adminPromotionsRouter, map.adminPromotionsRouter);
extract(adminTeamRouter, map.adminTeamRouter);
extract(adminPartnersRouter, map.adminPartnersRouter);
extract(adminEmailRouter, map.adminEmailRouter);
extract(betaRouter, map.betaRouter);
extract(partnerRegistrationRouter, map.partnerRegistrationRouter);
extract(portalRouter, map.portalRouter);
extract(buildersRouter, map.buildersRouter);
extract(marketComparisonRouter, map.marketComparisonRouter);
extract(priceAlertsRouter, map.priceAlertsRouter);
extract(aqiRouter, map.aqiRouter);
extract(commuteRouter, map.commuteRouter);
extract(builderReputationRouter, map.builderReputationRouter);
extract(transcribeRouter, map.transcribeRouter);
extract(documentsRouter, map.documentsRouter);
extract(registryPricesRouter, map.registryPricesRouter);
extract(builderRegistrationRouter, map.builderRegistrationRouter);
extract(builderApplicationsRouter, map.builderApplicationsRouter);
extract(analyticsRouter, map.analyticsRouter);
extract(shareRouter, map.shareRouter);
extract(adminIntelligenceRouter, map.adminIntelligenceRouter);

function convertPath(p: string) {
  return p.replace(/:([a-zA-Z0-9_]+)/g, '{$1}').replace(/\/$/, '');
}

routes.forEach(({ method, path: rawPath }) => {
  const swaggerPathKey = convertPath(rawPath);
  
  if (!swagger.paths[swaggerPathKey]) {
    swagger.paths[swaggerPathKey] = {};
  }
  
  if (!swagger.paths[swaggerPathKey][method]) {
    let tag = "System";
    if (rawPath.includes('/admin')) tag = "Admin";
    else if (rawPath.includes('/chat')) tag = "Chat";
    else if (rawPath.includes('/projects')) tag = "Projects";
    else if (rawPath.includes('/builders')) tag = "Builders";
    else if (rawPath.includes('/leads')) tag = "Leads";
    else if (rawPath.includes('/saved')) tag = "Saved";
    else if (rawPath.includes('/sessions')) tag = "Sessions";
    else if (rawPath.includes('/documents')) tag = "Documents";
    else if (rawPath.includes('/analytics')) tag = "Analytics";
    else if (rawPath.includes('/price-alerts')) tag = "Price Alerts";
    else if (rawPath.includes('/market')) tag = "Market";
    else if (rawPath.includes('/commute') || rawPath.includes('/aqi')) tag = "Location";
    else if (rawPath.includes('/transcribe')) tag = "Transcribe";
    else if (rawPath.includes('/builder-registration')) tag = "Builder Registration";
    else if (rawPath.includes('/builder-applications')) tag = "Builder Applications";
    
    const endpointDef: any = {
      summary: `Auto-generated endpoint for ${method.toUpperCase()} ${rawPath}`,
      tags: [tag],
      responses: {
        "200": {
          description: "Successful response"
        }
      }
    };
    
    if (tag === "Admin" && rawPath !== '/api/v1/admin/auth') {
      endpointDef.security = [{ "AdminSession": [] }];
    }
    
    const paramsMatch = rawPath.match(/:([a-zA-Z0-9_]+)/g);
    if (paramsMatch) {
      endpointDef.parameters = paramsMatch.map(p => ({
        name: p.substring(1),
        in: "path",
        required: true,
        schema: { type: "string" }
      }));
    }
    
    // Add default request body for POST/PUT/PATCH to prevent empty requests
    if (['post', 'put', 'patch'].includes(method)) {
      endpointDef.requestBody = {
        content: {
          "application/json": {
            schema: { type: "object", additionalProperties: true }
          }
        }
      };
    }
    
    swagger.paths[swaggerPathKey][method] = endpointDef;
    console.log(`Added: ${method.toUpperCase()} ${swaggerPathKey}`);
  }
});

fs.writeFileSync(swaggerPath, JSON.stringify(swagger, null, 2), 'utf8');
console.log('Swagger updated perfectly.');
