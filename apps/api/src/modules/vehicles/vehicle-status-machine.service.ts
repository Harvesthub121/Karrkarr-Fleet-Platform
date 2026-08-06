import { BadRequestException, Injectable } from '@nestjs/common';
import { VehicleStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Vehicle Status Machine
//
// WHY this transition table (key design decisions):
//
// 1. RENTED_OUT -> AVAILABLE is FORBIDDEN.
//    A vehicle returning from a rental always needs at minimum a cleaning pass,
//    and usually an inspection too. Skipping straight to AVAILABLE would mean
//    the next customer gets an unchecked car. Operations must route through
//    CLEANING -> AVAILABLE or INSPECTION -> AVAILABLE.
//
// 2. AVAILABLE and RESERVED are the only "ready for rental" states.
//    RESERVED means a draft agreement exists; the activation flip happens
//    in RentalsService which also transitions RESERVED -> RENTED_OUT atomically.
//
// 3. ACCIDENT_REPAIR can come from RENTED_OUT (accident reported mid-rental)
//    or CLEANING/INSPECTION (damage found post-return). Both paths allowed.
//
// 4. MAINTENANCE is reachable from AVAILABLE, INSPECTION, and CLEANING — an
//    inspector or cleaner might discover a mechanical issue. It is also
//    reachable from RENTED_OUT in the emergency case (breakdown mid-rental).
//
// 5. INACTIVE and SOLD are terminal from any state — a vehicle can be retired
//    or sold regardless of current operational status. This supports emergency
//    write-offs without bureaucratic path dependencies.
//
// 6. INSPECTION -> AVAILABLE: passed inspection, ready to rent.
//    CLEANING -> INSPECTION: cleaner says "needs a full inspection before
//    releasing", common for high-mileage returns.
//    CLEANING -> AVAILABLE: light clean, no issues, straight back to fleet.
// ---------------------------------------------------------------------------

export type StatusTransition = {
  from: VehicleStatus;
  to: VehicleStatus[];
};

export const STATUS_TRANSITIONS: Map<VehicleStatus, Set<VehicleStatus>> = new Map([
  [VehicleStatus.AVAILABLE, new Set([
    VehicleStatus.RESERVED,     // Admin reserves for upcoming rental
    VehicleStatus.MAINTENANCE,  // Proactive maintenance scheduled
    VehicleStatus.INSPECTION,   // Regulatory inspection due
    VehicleStatus.INACTIVE,     // Fleet retirement
    VehicleStatus.SOLD,         // Vehicle sold
  ])],

  [VehicleStatus.RESERVED, new Set([
    VehicleStatus.AVAILABLE,    // Reservation cancelled before activation
    VehicleStatus.RENTED_OUT,   // Rental agreement activated
    VehicleStatus.INACTIVE,
    VehicleStatus.SOLD,
  ])],

  [VehicleStatus.RENTED_OUT, new Set([
    // Cannot go directly to AVAILABLE — must pass through post-return workflow
    VehicleStatus.CLEANING,        // Normal return: clean first
    VehicleStatus.INSPECTION,      // Return with inspection flag
    VehicleStatus.ACCIDENT_REPAIR, // Accident reported mid-rental
    VehicleStatus.MAINTENANCE,     // Breakdown mid-rental (recovery scenario)
    VehicleStatus.INACTIVE,
    VehicleStatus.SOLD,
  ])],

  [VehicleStatus.CLEANING, new Set([
    VehicleStatus.AVAILABLE,       // Clean pass, no issues
    VehicleStatus.INSPECTION,      // Cleaner flagged potential issues
    VehicleStatus.MAINTENANCE,     // Mechanical issue discovered during clean
    VehicleStatus.ACCIDENT_REPAIR, // Damage discovered during clean
    VehicleStatus.INACTIVE,
    VehicleStatus.SOLD,
  ])],

  [VehicleStatus.INSPECTION, new Set([
    VehicleStatus.AVAILABLE,       // Passed inspection
    VehicleStatus.MAINTENANCE,     // Inspection found maintenance needed
    VehicleStatus.ACCIDENT_REPAIR, // Inspection found accident damage
    VehicleStatus.INACTIVE,
    VehicleStatus.SOLD,
  ])],

  [VehicleStatus.MAINTENANCE, new Set([
    VehicleStatus.AVAILABLE,       // Maintenance complete, cleared for rental
    VehicleStatus.INSPECTION,      // Post-maintenance inspection required
    VehicleStatus.INACTIVE,
    VehicleStatus.SOLD,
  ])],

  [VehicleStatus.ACCIDENT_REPAIR, new Set([
    VehicleStatus.INSPECTION,      // Repair complete, inspection required before re-fleet
    VehicleStatus.MAINTENANCE,     // Additional maintenance found during repair
    VehicleStatus.INACTIVE,        // Write-off after accident
    VehicleStatus.SOLD,            // Insurance total-loss sale
  ])],

  // Terminal states — no outbound transitions (vehicle leaves active fleet)
  [VehicleStatus.SOLD, new Set()],
  [VehicleStatus.INACTIVE, new Set()],
]);

@Injectable()
export class VehicleStatusMachineService {
  /**
   * Validate that a status transition is permitted by the machine.
   * Throws BadRequestException if the transition is forbidden.
   */
  assertTransitionAllowed(from: VehicleStatus, to: VehicleStatus): void {
    if (from === to) {
      throw new BadRequestException(`Vehicle is already in status ${to}`);
    }

    const allowed = STATUS_TRANSITIONS.get(from);
    if (!allowed || !allowed.has(to)) {
      throw new BadRequestException(
        `Transition from ${from} to ${to} is not permitted. ` +
          `Allowed targets: ${allowed ? [...allowed].join(', ') || 'none (terminal state)' : 'unknown'}`,
      );
    }
  }

  /** Return the set of statuses a vehicle may transition to from its current status. */
  allowedTransitions(from: VehicleStatus): VehicleStatus[] {
    return [...(STATUS_TRANSITIONS.get(from) ?? [])];
  }

  isTerminal(status: VehicleStatus): boolean {
    const targets = STATUS_TRANSITIONS.get(status);
    return targets !== undefined && targets.size === 0;
  }
}
