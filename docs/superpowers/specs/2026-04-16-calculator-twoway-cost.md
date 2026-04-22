# Two-Way Bind Calculator Design

## Purpose
Allow users to dynamically input their operational cost using either "Total Monthly Cost" or "Hourly Cost". Changing one will instantly adjust the other without requiring backend schema changes.

## Architecture & Data Flow
- **Source of Truth**: `operation.total_cost`, `operation.people_count`, and `operation.hours_per_month` will remain the source of truth in the database and `react-hook-form`.
- **UI Mechanism**: 
  - The "Custo/hora — calculado" field will be replaced with an interactive editable input.
  - A local state `localHourlyCost` will trace typed characters.
  - An `onChange` event on the Hourly Cost field will calculate the `total_cost` via formula `entered_hourly * people_count * hours_per_month` and update the hook form's `total_cost`.
  - A `useEffect` syncs changes the other way (Total -> Hourly) to keep the fields perfectly paired when `total_cost` is altered directly.

## Fallback Rules
- If `total_hours` is 0 (missing people or hours), the calculator gracefully defaults the hourly field to zero and protects against division by zero.
