export const PROFILE_ROLES = [
  "developer",
  "founder_owner",
  "designer",
  "hr_people",
  "ops",
  "marketer",
  "sales",
  "support",
  "other",
] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];

export const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1000+",
] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const INDUSTRIES = [
  "software_saas",
  "ecommerce_retail",
  "delivery_logistics",
  "healthcare",
  "finance",
  "education",
  "media",
  "manufacturing",
  "professional_services",
  "other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const INBOX_PURPOSES = [
  "customer_support",
  "staff_ops",
  "courier",
  "warehouse",
  "contractor",
  "sales",
  "other",
] as const;
export type InboxPurpose = (typeof INBOX_PURPOSES)[number];

export const INBOX_AUDIENCES = ["customer", "staff", "partner"] as const;
export type Audience = (typeof INBOX_AUDIENCES)[number];

export const LABELS = {
  role: {
    developer: "Developer",
    founder_owner: "Founder / Owner",
    designer: "Designer",
    hr_people: "HR / People",
    ops: "Operations",
    marketer: "Marketer",
    sales: "Sales",
    support: "Customer support",
    other: "Something else",
  },
  industry: {
    software_saas: "Software / SaaS",
    ecommerce_retail: "E-commerce / Retail",
    delivery_logistics: "Delivery / Logistics",
    healthcare: "Healthcare",
    finance: "Finance",
    education: "Education",
    media: "Media",
    manufacturing: "Manufacturing",
    professional_services: "Professional services",
    other: "Something else",
  },
  purpose: {
    customer_support: "Customer support",
    staff_ops: "Staff operations",
    courier: "Couriers / Drivers",
    warehouse: "Warehouse",
    contractor: "Contractors",
    sales: "Sales",
    other: "Something else",
  },
  audience: {
    customer: "Customers",
    staff: "Staff",
    partner: "Partners",
  },
} as const;
