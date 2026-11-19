// Engineering estimate derived from the five original watertight STL volumes.
// Density 1240 kg/m^3 assumes solid PLA; printed part masses may differ.
// 28BYJ-48 example motor mass 32 g, NOT measured on the user's three motors.
// The reported 34.3 mN*m at 120 Hz is a reference test value, NOT a torque-speed curve.
export const motorReferenceTorqueNm=.0343;
const A=.120,B=.100,T=.060;
const links=[
  {mass:.040285,com:.066559,Iz:.0000793213},
  {mass:.035488,com:.054871,Iz:.0000525979},
  {mass:.032364,com:.041044,Iz:.0000227887}
];
const motorMass=.032,penMass=.018;
// Maximum moment of inertia at the straight, extended configuration;
// inertia about each upstream revolute axis (parallel axis theorem).
const I=[
 links[0].Iz+links[0].mass*links[0].com**2+
 links[1].Iz+links[1].mass*(A+links[1].com)**2+
 links[2].Iz+links[2].mass*(A+B+links[2].com)**2+
 penMass*(A+B+T)**2+
 motorMass*A*A+motorMass*(A+B)**2,
 links[1].Iz+links[1].mass*links[1].com**2+
 links[2].Iz+links[2].mass*(B+links[2].com)**2+
 penMass*(B+T)**2+
 motorMass*B*B,
 links[2].Iz+links[2].mass*links[2].com**2+penMass*T*T
];
const reach=[A+B+T,B+T,T];
/** Worst-direction planar pen force + independent joint angular acceleration.
 * NO bearing friction, gearbox lost steps, collision impulse or torque-speed degradation.
 * This is a useful lower-bound demand estimate, NOT safe-to-operate validation.
 */
export function estimateTorque(forceN=.10,accelRadS2=.50) {
 if(!Number.isFinite(forceN)||forceN<0||forceN>.5)throw Error('Pen force out of range');
 if(!Number.isFinite(accelRadS2)||accelRadS2<0||accelRadS2>5)throw Error('Acceleration out of range');
 return I.map((inertia,i)=>({
  joint:i+1,inertia,reaches:reach[i],
  dragNm:forceN*reach[i],inertiaNm:accelRadS2*inertia,
  torqueNm:forceN*reach[i]+accelRadS2*inertia,
  fraction:(forceN*reach[i]+accelRadS2*inertia)/motorReferenceTorqueNm
 }));
}
export const motorModelAssumptions={
 motorMassKg:motorMass,penMassKg:penMass,solidPlaDensityKgM3:1240,
 motorReferenceTorqueNm,torqueTestFrequencyHz:120,nominalHalfStepsPerRev:4096,
 note:'No mechanical friction, gearbox backlash, wear, voltage drop or dynamic torque curve included. Unverified.'
};
