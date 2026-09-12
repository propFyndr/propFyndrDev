require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedNewTables() {
  console.log('=== SEEDING NEW UTILITY & CONTENT TABLES ===');

  // 1. BLOG POSTS (5 High-Authority Real Estate Guides)
  console.log('Seeding Blog Posts...');
  await prisma.blogPost.deleteMany();
  const posts = [
    {
      title: "Why Flat Registries Get Blocked Even After Physical Possession in Noida & Greater Noida West",
      slug: "why-flat-registries-blocked-noida-greater-noida-west",
      excerpt: "Understanding the dangerous gap between physical keys and legal sub-lease deed registration, builder land dues, and the tripartite registry framework.",
      content: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: "Over 1.5 lakh homebuyers across Noida and Greater Noida West find themselves in a precarious legal limbo: they hold the physical keys to their apartments, reside in the units, and pay monthly maintenance, yet they do not legally own the property. Their registries remain stalled for years." }]
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: "The Root Cause: Unpaid Authority Land Premium" }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: "In Gautam Buddha Nagar (NOIDA, GNIDA, YEIDA), land is allotted to private developers on a 90-year leasehold model under a 10:90 deferred installment scheme. Developers paid an initial 10% down payment and were expected to pay annual land installments. Many developers diverted buyer receivables into secondary land auctions rather than clearing installment dues, accumulating tens of thousands of crores in interest penalties." }]
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: "Keys vs Sub-Lease Deed: The Legal Trap" }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: "Physical handover on an informal 'Fit-Out Possession Letter' conveys zero legal ownership. Without a registered Tripartite Sub-Lease Deed executed between the Authority, Developer, and Homebuyer at the Sub-Registrar Office, the flat cannot be officially mortgaged, bequeathed, or cleanly resold without immense friction." }]
          }
        ]
      }),
      status: 'published',
      published_at: new Date('2026-08-01T09:00:00Z'),
      author_name: 'PropFyndr Advisory Research',
      meta_title: 'Why Flat Registries are Blocked in Noida | Legal Buyer Advisory',
      meta_description: 'Discover why thousands of flats in Noida & Greater Noida West have pending registries despite physical possession, and how the Amitabh Kant committee reforms apply.'
    },
    {
      title: "The True Landed Cost Equation: Why a ₹1.50 Cr BSP Flat Costs ₹1.82 Cr in NCR",
      slug: "true-landed-cost-breakdown-ncr-apartments",
      excerpt: "A transparent, rupee-for-rupee breakdown of Basic Sale Price vs true out-of-pocket expenditure including GST, Stamp Duty, IFMS, PLC, and utility connection fees.",
      content: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: "Real estate brochures prominently market the Basic Sale Price (BSP) in large font, misleading first-time buyers into assuming their budget stretches further than it actually does. In the NCR market, the all-inclusive landed cost is consistently 20% to 26% higher than the BSP." }]
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: "The 8 Compounding Cost Layers" }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: "1. GST: 5% on under-construction non-affordable units (₹7.50 Lakh on ₹1.5 Cr BSP).\n2. UP Stamp Duty: 7% for male applicants, 6% for female applicants.\n3. Registration Fee: 1% flat to the Sub-Registrar.\n4. Preferential Location Charges (PLC): ₹250 to ₹600 per sq.ft for corner, park, or high-rise vantage.\n5. Covered Parking: ₹3.50 Lakh to ₹6.00 Lakh per bay.\n6. One-Time Authority Lease Rent: 10% of underlying land proportion.\n7. IFMS (Interest-Free Maintenance Security): ₹50 to ₹100 per sq.ft.\n8. Power Backup & Dual Meter Setup: ₹1.50 Lakh to ₹2.50 Lakh." }]
          }
        ]
      }),
      status: 'published',
      published_at: new Date('2026-08-10T09:00:00Z'),
      author_name: 'PropFyndr Advisory Research',
      meta_title: 'True Landed Cost Breakdown of Noida Apartments | Math Guide',
      meta_description: 'Calculate your actual all-inclusive cost before paying token money: GST, stamp duty, lease rent, parking, and hidden developer charges in Noida & Greater Noida.'
    },
    {
      title: "Leasehold vs Freehold in Noida, Greater Noida & YEIDA: The 90-Year Authority Reality",
      slug: "leasehold-vs-freehold-noida-greater-noida-yeida-mechanics",
      excerpt: "Everything you need to know about 90-year authority lease deeds, Transfer Memorandum (TM) charges, and why UP authorities defer freehold conversion.",
      content: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: "Unlike Delhi or Gurgaon where several residential enclaves offer freehold title, almost all planned sectors across NOIDA, Greater Noida, and Yamuna Expressway operate under a 90 to 99-year leasehold framework established under the UP Industrial Area Development Act 1976." }]
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: "Can Leasehold Ever Be Converted to Freehold?" }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: "While political representations frequently propose freehold conversion, the UP State Government has repeatedly deferred blanket conversion because lease rent revenues, transfer fees (TM), and mortgage permission charges form the primary self-funding fiscal engine for regional expressways, metro extensions, and municipal upkeep." }]
          }
        ]
      }),
      status: 'published',
      published_at: new Date('2026-08-15T09:00:00Z'),
      author_name: 'PropFyndr Advisory Research',
      meta_title: 'Leasehold vs Freehold in Noida & YEIDA | Title & TM Guide',
      meta_description: 'An authoritative guide explaining why Noida land is leasehold, how Transfer Memorandum (TM) charges work on resale, and how to verify bank loan eligibility.'
    },
    {
      title: "How to Detect and Avoid Unauthorized Plotting Scams Along the Yamuna Expressway (YEIDA)",
      slug: "how-to-avoid-unauthorized-plotting-scams-yamuna-expressway",
      excerpt: "Guarding against fraudulent private colonies, fake 5% & 6% Kisan Quota plots, and unapproved farmhouse schemes near Noida International Airport.",
      content: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: "The anticipation surrounding the commercial launch of Noida International Airport (Jewar) has triggered a wave of unorganized land dealers carving illegal plotted colonies out of agricultural green belts along the Yamuna Expressway." }]
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: "The 3 Red Flags of Illegal Land Deals" }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: "1. Selling on Power of Attorney (GPA) or Agreement to Sell without a sanctioned YEIDA layout.\n2. Marketing unverified 'Kisan Quota' 6% abadi plots that are still under mandatory lock-in or tangled in village consolidation litigation.\n3. Promising immediate registry on agricultural revenue land without Section 143 / 80 conversion under the UP Revenue Code." }]
          }
        ]
      }),
      status: 'published',
      published_at: new Date('2026-08-20T09:00:00Z'),
      author_name: 'PropFyndr Advisory Research',
      meta_title: 'YEIDA Plot Verification Guide | Avoid Jewar Airport Land Scams',
      meta_description: 'Essential due diligence for land buyers along Yamuna Expressway. Learn how to verify official YEIDA sector plots vs illegal private colonizers.'
    },
    {
      title: "Strategic ₹3 Crore Real Estate Portfolio: Noida Expressway vs Greno West vs Dwarka Expressway",
      slug: "strategic-3-crore-portfolio-noida-expressway-greno-west-dwarka",
      excerpt: "Where should an investor or family allocate ₹3 Crore in 2026? Comparing rental yield, infrastructure catalysts, capital appreciation, and livability.",
      content: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: "A budget of ₹3.00 Crore opens distinct investment corridors across Delhi-NCR: an ultra-luxury 3/4 BHK in low-density Sector 150/128, a diversified multi-unit rental portfolio in Greater Noida West, or an entry-level luxury high-rise on Gurgaon's Dwarka Expressway." }]
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: "Corridor Comparison Matrix" }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: "- **Noida Expressway (Sec 150/128)**: 80% open green podium, low density, high liveability, 20-min Jewar access. Yield: 3.2%–3.8%.\n- **Greater Noida West (Sec 10/12)**: Maximum space per Rupee, high commercial absorption, rapid metro connectivity. Yield: 3.6%–4.4%.\n- **Dwarka Expressway**: High appreciation momentum, adjacent to IGI Airport & Cyber City, but premium entry pricing (>₹16,000/sq.ft)." }]
          }
        ]
      }),
      status: 'published',
      published_at: new Date('2026-08-25T09:00:00Z'),
      author_name: 'PropFyndr Advisory Research',
      meta_title: '₹3 Crore Real Estate Portfolio Allocation in NCR | 2026 Guide',
      meta_description: 'Detailed financial and qualitative comparison of allocating ₹3 Crore across Noida Expressway, Greater Noida West, and Dwarka Expressway.'
    }
  ];

  for (const post of posts) {
    await prisma.blogPost.create({ data: post });
  }
  console.log(`Created ${posts.length} publication blog posts.`);

  // 2. BUILDER NEWS
  console.log('Seeding Builder News...');
  await prisma.builderNews.deleteMany();
  const topBuilders = await prisma.builder.findMany({ take: 12 });
  if (topBuilders.length > 0) {
    for (let i = 0; i < topBuilders.length; i++) {
      const b = topBuilders[i];
      await prisma.builderNews.create({
        data: {
          builder_id: b.id,
          title: `${b.name} Achieves Major Construction Milestone Across Flagship Corridor`,
          description: `Independent structural and engineering audit confirms expedited delivery schedules and zero pending compliance flags for ongoing residential towers under ${b.name}.`,
          status: 'published',
          published_at: new Date(Date.now() - (i * 3 + 1) * 86400000),
          image_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f7?auto=format&fit=crop&w=800&q=80',
          link_type: 'builder',
          link_target: b.id
        }
      });
    }
    console.log(`Created ${topBuilders.length} builder news updates.`);
  }

  // 3. PROMOTIONALS
  console.log('Seeding Promotionals...');
  await prisma.promotional.deleteMany();
  const promoTypes = ['button', 'toast_text', 'news_feature'];
  const promos = [
    {
      title: 'Zero Brokerage Certified Advisory',
      description: 'Consult licensed fiduciary real estate advisors with 100% verified RERA records.',
      type: 'toast_text',
      content: 'Get independent legal due diligence and floor-by-floor pricing analysis at zero brokerage.',
      starts_at: new Date(),
      ends_at: new Date(Date.now() + 90 * 86400000),
      is_active: true,
      target_sectors: ['Sector 150', 'Sector 128', 'Sector 10', 'Sector 78']
    },
    {
      title: 'Jewar Airport Corridor Investor Guide',
      description: 'Download the comprehensive 2026 YEIDA master plan & legal verification checklist.',
      type: 'news_feature',
      content: 'Understand sanctioned commercial zones, logistics parks, and approved residential sectors.',
      starts_at: new Date(),
      ends_at: new Date(Date.now() + 120 * 86400000),
      is_active: true,
      target_sectors: ['Sector 22D', 'Yamuna Expressway']
    },
    {
      title: 'Ready-to-Move Registry Assurance Program',
      description: 'Exclusive inventory with OC obtained and guaranteed zero builder authority dues.',
      type: 'button',
      content: 'Explore verified apartments ready for immediate sub-lease deed registration and possession.',
      starts_at: new Date(),
      ends_at: new Date(Date.now() + 60 * 86400000),
      is_active: true,
      target_sectors: []
    }
  ];

  for (const p of promos) {
    await prisma.promotional.create({ data: p });
  }
  console.log(`Created ${promos.length} promotional campaigns.`);

  // 4. BUILDER THEMES
  console.log('Seeding Builder Themes...');
  await prisma.builderTheme.deleteMany();
  const themeColors = [
    { primary: '#0D8ABC', secondary: '#F4F8FA' },
    { primary: '#1B365D', secondary: '#E6ECF2' },
    { primary: '#2E7D32', secondary: '#E8F5E9' },
    { primary: '#C59B27', secondary: '#FDF8EA' },
    { primary: '#D32F2F', secondary: '#FFEBEE' }
  ];
  for (let i = 0; i < Math.min(topBuilders.length, 5); i++) {
    const b = topBuilders[i];
    const tc = themeColors[i % themeColors.length];
    await prisma.builderTheme.create({
      data: {
        builder_id: b.id,
        primary_color: tc.primary,
        secondary_color: tc.secondary,
        active_from: new Date(),
        is_active: true
      }
    });
  }
  console.log('Created builder themes for top builders.');

  // 5. NOTIFICATION OUTBOX
  console.log('Seeding Notification Outbox...');
  await prisma.notificationOutbox.deleteMany();
  await prisma.notificationOutbox.create({
    data: {
      channel: 'email',
      to_email: 'admin@propfyndr.com',
      template: 'admin_invite',
      subject: 'Welcome to PropFyndr Enterprise System',
      body: 'Your administrative account has been verified with full read-write access to the NCR project master database.',
      status: 'sent',
      sent_at: new Date(),
      sent_by: 'system@propfyndr.com',
      related_type: 'admin_user'
    }
  });
  console.log('Created initial notification outbox record.');

  // 6. BUILDER DELIVERY RECORDS
  console.log('Seeding Builder Delivery Records...');
  await prisma.builderDeliveryRecord.deleteMany();
  for (let i = 0; i < Math.min(topBuilders.length, 8); i++) {
    const b = topBuilders[i];
    await prisma.builderDeliveryRecord.create({
      data: {
        builder_id: b.id,
        project_name: `${b.name} Phase I Flagship`,
        promised_date: new Date('2022-06-30'),
        actual_date: new Date('2022-09-15')
      }
    });
  }
  console.log('Created builder delivery records.');

  console.log('=== SEEDING NEW TABLES COMPLETE ===');
  process.exit(0);
}

seedNewTables().catch(err => {
  console.error(err);
  process.exit(1);
});
