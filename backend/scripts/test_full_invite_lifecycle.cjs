// backend/scripts/test_full_invite_lifecycle.cjs
//
// End-to-end test of the entire team invite lifecycle:
// 1. Super Admin authentication
// 2. Super Admin invites lower-level admin (ANALYST)
// 3. Invite link retrieval: resend-invite hands back the SAME live token, so a
//    link already emailed to the invitee keeps working
// 4. Invite acceptance: open accept-invite page and submit password
// 5. Bogus token rejection, and resend refused once the account is activated
// 6. User authentication: new lower-level admin logs in
// 7. RBAC access checks:
//    - ANALYST can view projects & stats (200 OK)
//    - ANALYST cannot access team management (403 Forbidden)
// 8. Super admin role update: elevate/change role to SALES
// 9. Cleanup test user from DB

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

// Never hardcode the root admin password in a file that lands in the repo.
const ROOT_PASSWORD = process.env.ADMIN_ROOT_PASSWORD;
if (!ROOT_PASSWORD) {
  console.error('Set ADMIN_ROOT_PASSWORD before running this script.');
  process.exit(1);
}

async function runTest() {
  console.log('====================================================');
  console.log('🚀 Starting Full Invite & Role Flow Integration Test');
  console.log('====================================================\n');

  const testEmail = `qa.analyst.${Date.now()}@propfyndr.in`;
  const initialPassword = 'AnalystPassword@2026';

  try {
    // ── Step 1: Super Admin Authentication ───────────────────────────
    console.log('▶ Step 1: Super Admin logs in...');
    const superAdminRes = await fetch(`${API_URL}/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ROOT_PASSWORD }),
    });
    if (!superAdminRes.ok) throw new Error(`Super admin login failed: ${superAdminRes.status}`);
    const superAdminData = await superAdminRes.json();
    const superAdminToken = superAdminData.token;
    console.log(`✔ Super Admin authenticated successfully. Token: ${superAdminToken.slice(0, 8)}...\n`);

    const superAdminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`,
      'Cookie': `admin_session=${superAdminToken}`,
    };

    // ── Step 2: Super Admin invites a new ANALYST ────────────────────
    console.log(`▶ Step 2: Super Admin invites new member: ${testEmail} as ANALYST...`);
    const inviteRes = await fetch(`${API_URL}/admin/team/invite`, {
      method: 'POST',
      headers: superAdminHeaders,
      body: JSON.stringify({
        email: testEmail,
        role: 'ANALYST',
      }),
    });
    if (!inviteRes.ok) throw new Error(`Invite creation failed: ${inviteRes.status} ${await inviteRes.text()}`);
    const inviteData = await inviteRes.json();
    const initialLink = inviteData.inviteUrl;
    const initialToken = new URL(initialLink).searchParams.get('token');
    const createdAdminId = inviteData.admin.id;
    console.log(`✔ Invite created! Admin ID: ${createdAdminId}`);
    console.log(`  Initial Invite Link: ${initialLink}`);
    console.log(`  Initial Token: ${initialToken}\n`);

    // ── Step 3: Retrieving the link does not invalidate it ────────────
    // "Copy Link" and the email preview both call resend-invite. If that
    // rotated the token, a link the super-admin had already emailed would stop
    // working the moment they opened the preview.
    console.log('▶ Step 3: Retrieving the invite link again (Copy Link / preview path)...');
    const resendRes = await fetch(`${API_URL}/admin/team/${createdAdminId}/resend-invite`, {
      method: 'POST',
      headers: superAdminHeaders,
    });
    if (!resendRes.ok) throw new Error(`Resend invite failed: ${resendRes.status}`);
    const resendData = await resendRes.json();
    const freshLink = resendData.inviteUrl;
    const freshToken = new URL(freshLink).searchParams.get('token');
    console.log(`  Returned Invite Link: ${freshLink}`);

    if (freshToken !== initialToken) {
      throw new Error('Retrieving the link rotated the token — the already-sent invite would be dead.');
    }
    if (resendData.rotated !== false) {
      throw new Error(`Expected rotated:false for a live invite, got ${resendData.rotated}`);
    }
    console.log('✔ Verified: the live token was returned unchanged; already-sent links keep working.\n');

    // ── Step 4: Verify a bogus token is rejected ─────────────────────
    console.log('▶ Step 4: Verifying an unknown token is rejected...');
    const bogusAttempt = await fetch(`${API_URL}/admin/team/accept-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'not_a_real_invite_token', password: 'SomePassword123' }),
    });
    if (bogusAttempt.status !== 400) {
      throw new Error(`Unknown token should have returned 400, but got ${bogusAttempt.status}`);
    }
    console.log('✔ Verified: unknown token rejected (400 Bad Request).\n');

    // ── Step 5: User clicks the fresh link & accepts invite ──────────
    console.log('▶ Step 5: User opens fresh invite page & sets password...');
    const pageCheck = await fetch(`${BASE_URL}/admin/accept-invite?token=${freshToken}`);
    if (pageCheck.status !== 200) throw new Error(`Accept invite page returned status ${pageCheck.status}`);
    console.log('✔ Accept-invite web page loaded successfully (HTTP 200).');

    const acceptRes = await fetch(`${API_URL}/admin/team/accept-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: freshToken, password: initialPassword }),
    });
    if (!acceptRes.ok) throw new Error(`Accept invite failed: ${acceptRes.status} ${await acceptRes.text()}`);
    const acceptData = await acceptRes.json();
    console.log(`✔ Password set successfully:`, acceptData);

    // Verify DB state
    const dbAdmin = await prisma.adminUser.findUnique({ where: { id: createdAdminId } });
    if (dbAdmin.invite_token !== null || dbAdmin.password_hash === null) {
      throw new Error('Database adminUser still has invite_token or missing password_hash!');
    }
    console.log('✔ Database state verified: invite_token cleared, password_hash recorded.\n');

    // An invite token is the credential accept-invite accepts. Minting one for
    // an account that already has a password is a password reset wearing an
    // invite's name, so the endpoint must refuse.
    console.log('▶ Step 5b: Verifying resend-invite is refused for an activated account...');
    const resendAfterAccept = await fetch(`${API_URL}/admin/team/${createdAdminId}/resend-invite`, {
      method: 'POST',
      headers: superAdminHeaders,
    });
    if (resendAfterAccept.status !== 400) {
      throw new Error(`Resend on an activated account should return 400, got ${resendAfterAccept.status}`);
    }
    const postAcceptAdmin = await prisma.adminUser.findUnique({ where: { id: createdAdminId } });
    if (postAcceptAdmin.invite_token !== null) {
      throw new Error('Refused resend still wrote an invite_token onto an activated account.');
    }
    console.log('✔ Verified: activated accounts cannot be handed a new invite link.\n');

    // ── Step 6: User logs in with newly created credentials ──────────
    console.log(`▶ Step 6: New user logs in with credentials (${testEmail})...`);
    const userLoginRes = await fetch(`${API_URL}/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: initialPassword }),
    });
    if (!userLoginRes.ok) throw new Error(`New user login failed: ${userLoginRes.status} ${await userLoginRes.text()}`);
    const userLoginData = await userLoginRes.json();
    const userToken = userLoginData.token;
    console.log(`✔ User logged in successfully! Role: ${userLoginData.role}, Token: ${userToken.slice(0, 8)}...\n`);

    const userHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`,
      'Cookie': `admin_session=${userToken}`,
    };

    // ── Step 7: RBAC Access Control Verification ────────────────────
    console.log('▶ Step 7: Verifying Role-Based Access Control (RBAC)...');
    // A) ANALYST should be allowed to view projects
    const projectsRes = await fetch(`${API_URL}/admin/projects`, { headers: userHeaders });
    console.log(`  ANALYST accessing /admin/projects: HTTP ${projectsRes.status} (${projectsRes.ok ? 'ALLOWED ✔' : 'FAILED ❌'})`);
    if (!projectsRes.ok) throw new Error('ANALYST was unable to access /admin/projects');

    // B) ANALYST should NOT be allowed to access team management (/admin/team)
    const teamRes = await fetch(`${API_URL}/admin/team`, { headers: userHeaders });
    console.log(`  ANALYST accessing /admin/team: HTTP ${teamRes.status} (${teamRes.status === 403 ? 'FORBIDDEN as required ✔' : 'FAILED ❌'})`);
    if (teamRes.status !== 403) throw new Error(`Expected 403 Forbidden for ANALYST on /admin/team, got ${teamRes.status}`);
    console.log('✔ RBAC checks passed perfectly!\n');

    // ── Step 8: Super Admin updates role to SALES ────────────────────
    console.log('▶ Step 8: Super Admin promotes / updates member role to SALES...');
    const updateRes = await fetch(`${API_URL}/admin/team/${createdAdminId}`, {
      method: 'PATCH',
      headers: superAdminHeaders,
      body: JSON.stringify({ role: 'SALES' }),
    });
    if (!updateRes.ok) throw new Error(`Role update failed: ${updateRes.status}`);
    const updateData = await updateRes.json();
    console.log(`✔ Role updated: ${updateData.admin.role}`);

    // Re-login user to get fresh session with SALES role
    const reLoginRes = await fetch(`${API_URL}/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: initialPassword }),
    });
    const reLoginData = await reLoginRes.json();
    console.log(`✔ User re-authenticated with updated role: ${reLoginData.role}\n`);

    // ── Step 9: Cleanup ──────────────────────────────────────────────
    console.log('▶ Step 9: Cleaning up test user from database...');
    await prisma.adminUser.delete({ where: { id: createdAdminId } });
    console.log('✔ Cleanup complete.\n');

    console.log('====================================================');
    console.log('🎉 ALL TESTS PASSED! Flow is 100% smooth & robust!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
