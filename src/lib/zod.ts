import { z } from "zod";

// Default messages in Spanish for every schema that imports z from here;
// user-facing fields still carry their own wording.
z.config(z.locales.es());

export { z };
