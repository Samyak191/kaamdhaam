CREATE INDEX "freelancer_profiles_location_city_location_state_idx" ON "freelancer_profiles"("location_city", "location_state");
CREATE INDEX "freelancer_profiles_created_at_id_idx" ON "freelancer_profiles"("created_at", "id");
DROP INDEX "skills_name_lower_idx";
CREATE UNIQUE INDEX "skills_name_lower_key" ON "skills" (lower("name"));
ALTER TABLE "skills" ADD CONSTRAINT "skills_name_normalized" CHECK ("name" = lower(btrim("name")) AND length("name") BETWEEN 2 AND 80);
