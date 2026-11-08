/**
 * Site-wide constants. The public marketing site lives on WordPress at
 * handson.cloud; this application is served from app.handson.cloud.
 */
export const site = {
  name: "Handson",
  publicUrl: "https://handson.cloud",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  contact: {
    email: "hello@handson.cloud",
    phone: "+258 84 889 7211",
    phoneHref: "tel:+258848897211",
    whatsapp: "https://wa.me/258848897211",
    city: "Maputo, Mozambique",
  },
  links: {
    privacy: "https://handson.cloud/privacy-policy/",
    terms: "https://handson.cloud/terms/",
    contact: "https://handson.cloud/contact/",
    about: "https://handson.cloud/about/",
  },
  market: {
    country: "Mozambique",
    countryCode: "MZ",
    dialCode: "+258",
    currency: "MZN",
    timeZone: "Africa/Maputo",
  },
} as const;
