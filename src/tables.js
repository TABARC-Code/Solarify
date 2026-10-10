/* Solarify world-building tables. Author: TABARC-Code.
 *
 * Data only: the lookup tables the system builder rolls on or reads from (star evolution, orbit spacing,
 * size classes, densities, atmosphere and greenhouse factors, climate bands, and so on). They are
 * tabletop-style rules of thumb, chosen to make believable systems, not a current astrophysics dataset.
 *
 * Dice ranges are written [low, high], with -99 and 99 meaning 'or less' and 'or more'.
 * Each table's columns are described above it.
 */
(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SolarifyTables = api;
})(typeof window !== 'undefined' ? window : this, function(){
'use strict';
var T = {};
// [mass (Sun), spectral type, Teff K, L at start of main sequence, L at its end (null = no change), main-sequence Gyr, subgiant Gyr, giant Gyr]
T.starEvolution = [[0.1,"M7",3100,0.0012,null,null,null,null],[0.15,"M6",3200,0.0036,null,null,null,null],[0.2,"M5",3200,0.0079,null,null,null,null],[0.25,"M4",3300,0.015,null,null,null,null],[0.3,"M4",3300,0.024,null,null,null,null],[0.35,"M3",3400,0.037,null,null,null,null],[0.4,"M2",3500,0.054,null,null,null,null],[0.45,"M1",3600,0.07,0.08,70,null,null],[0.5,"M0",3800,0.09,0.11,59,null,null],[0.55,"K8",4000,0.11,0.15,50,null,null],[0.6,"K6",4200,0.13,0.2,42,null,null],[0.65,"K5",4400,0.15,0.25,37,null,null],[0.7,"K4",4600,0.19,0.35,30,null,null],[0.75,"K2",4900,0.23,0.48,24,null,null],[0.8,"K0",5200,0.28,0.65,20,null,null],[0.85,"G8",5400,0.36,0.84,17,null,null],[0.9,"G6",5500,0.45,1,14,null,null],[0.95,"G4",5700,0.56,1.3,12,1.8,1.1],[1,"G2",5800,0.68,1.6,10,1.6,1],[1.05,"G1",5900,0.87,1.9,8.8,1.4,0.8],[1.1,"G0",6000,1.1,2.2,7.7,1.2,0.7],[1.15,"F9",6100,1.4,2.6,6.7,1,0.6],[1.2,"F8",6300,1.7,3,5.9,0.9,0.6],[1.25,"F7",6400,2.1,3.5,5.2,0.8,0.5],[1.3,"F6",6500,2.5,3.9,4.6,0.7,0.4],[1.35,"F5",6600,3.1,4.5,4.1,0.6,0.4],[1.4,"F4",6700,3.7,5.1,3.7,0.6,0.4],[1.45,"F3",6900,4.3,5.7,3.3,0.5,0.3],[1.5,"F2",7000,5.1,6.5,3,0.5,0.3],[1.6,"F0",7300,6.7,8.2,2.5,0.4,0.2],[1.7,"A9",7500,8.6,10,2.1,0.3,0.2],[1.8,"A7",7800,11,13,1.8,0.3,0.2],[1.9,"A6",8000,13,16,1.5,0.2,0.1],[2,"A5",8200,16,20,1.3,0.2,0.1]];
// [mass (Sun), luminosity (Sun), Teff K, stable life in Gyr]
T.massiveStars = [[3.0,90.0,9800.0,0.33],[5.0,700.0,14000.0,0.07],[7.5,3600.0,18000.0,0.02],[10.0,11000.0,20000.0,0.009],[15.0,58000.0,26000.0,0.0026],[20.0,180000.0,32000.0,0.0011],[25.0,440000.0,36000.0,0.00057],[30.0,920000.0,40000.0,0.00033],[60.0,15000000.0,42000.0,4e-05],[100.0,110000000.0,50000.0,9e-06]];
// [[3d low, high], population, base Gyr, step A Gyr, step B Gyr]; age = base + (1d-1)*A + (1d-1)*B
T.systemAge = [[[3,3],"Extreme Population I",0,0,0],[[4,6],"Young Population I",0.1,0.3,0.05],[[7,10],"Intermediate Population I",2,0.6,0.1],[[11,14],"Old Population I",5.6,0.6,0.1],[[15,17],"Intermediate Population II",8,0.6,0.1],[[18,18],"Extreme Population II",10,0.6,0.1]];
// [[2d low, high], class, distance multiplier in AU]; mean separation = 2d x multiplier
T.companionSeparation = [[[-99,6],"Very Close",0.05],[[7,9],"Close",0.5],[[10,11],"Moderate",2.0],[[12,14],"Wide",10.0],[[15,99],"Distant",50.0]];
// [[3d low, high], eccentricity]
T.starEccentricity = [[[-99,3],0.0],[[4,4],0.1],[[5,5],0.2],[[6,6],0.3],[[7,8],0.4],[[9,11],0.5],[[12,13],0.6],[[14,15],0.7],[[16,16],0.8],[[17,17],0.9],[[18,99],0.95]];
// [[3d low, high], ratio between neighbouring orbits]
T.orbitSpacing = [[[3,4],1.4],[[5,6],1.5],[[7,8],1.6],[[9,12],1.7],[[13,14],1.8],[[15,16],1.9],[[17,18],2.0]];
// [[3d low, high], eccentricity]
T.planetEccentricity = [[[-99,3],0.0],[[4,6],0.05],[[7,9],0.1],[[10,11],0.15],[[12,12],0.2],[[13,13],0.3],[[14,14],0.4],[[15,15],0.5],[[16,16],0.6],[[17,17],0.7],[[18,99],0.8]];
// [[3d low, high], class]
T.gasGiantSize = [[[3,10],"Small"],[[11,16],"Medium"],[[17,99],"Large"]];
// [[3d low, high], what fills an orbit]
T.orbitContents = [[[-99,3],"Empty orbit"],[[4,6],"Asteroid belt"],[[7,8],"Terrestrial planet (Tiny)"],[[9,11],"Terrestrial planet (Small)"],[[12,15],"Terrestrial planet (Standard)"],[[16,99],"Terrestrial planet (Large)"]];
// [[3d low, high], base tilt rule]; the last row sends you to the extended table
T.axialTilt = [[[3,6],"0 + (2d-2) degrees"],[[7,9],"10 + (2d-2) degrees"],[[10,12],"20 + (2d-2) degrees"],[[13,14],"30 + (2d-2) degrees"],[[15,16],"40 + (2d-2) degrees"],[[17,18],"Roll on extended table"]];
// [[1d low, high], base tilt rule]
T.axialTiltExtended = [[[1,2],"50 + (2d-2) degrees"],[[3,4],"60 + (2d-2) degrees"],[[5,5],"70 + (2d-2) degrees"],[[6,6],"80 + (2d-2) degrees"]];
// [world label, absorption factor, greenhouse factor]
T.absorption = [["Asteroid Belt",0.97,0.0],["Tiny (Ice)",0.86,0.0],["Tiny (Rock)",0.97,0.0],["Tiny (Sulfur)",0.77,0.0],["Small (Hadean)",0.67,0.0],["Small (Ice)",0.93,0.1],["Small (Rock)",0.96,0.0],["Standard (Hadean)",0.67,0.0],["Standard or Large (Ammonia)",0.84,0.2],["Standard or Large (Ice)",0.86,0.2],["Standard or Large (Ocean or Garden) (Hydrographics 20% or less)",0.95,0.16],["Standard or Large (Ocean or Garden) (Hydrographics 21% to 50%)",0.92,0.16],["Standard or Large (Ocean or Garden) (Hydrographics 51% to 90%)",0.88,0.16],["Standard or Large (Ocean or Garden) (Hydrographics 91% or more)",0.84,0.16],["Standard or Large (Greenhouse)",0.77,2.0],["Standard or Large (Chthonian)",0.97,0.0]];
// [[3d low, high], icy core, small iron core, large iron core] in Earth densities
T.densityByCore = [[[3,6],0.3,0.6,0.8],[[7,10],0.4,0.7,0.9],[[11,14],0.5,0.8,1.0],[[15,17],0.6,0.9,1.1],[[18,18],0.7,1.0,1.2]];
// [size class, minimum factor, maximum factor]; diameter (Earth) = sqrt(blackbody K / density) x factor
T.sizeConstraints = [["Large",0.065,0.091],["Standard",0.03,0.065],["Small",0.024,0.03],["Tiny",0.004,0.024]];
// [world label, factor]; pressure (atm) = atmosphere mass x factor x gravity
T.pressureFactor = [["Small (Ice)",10.0],["Standard (Ammonia, Ice, Ocean, or Garden)",1.0],["Standard (Greenhouse)",100.0],["Large (Ammonia, Ice, Ocean, or Garden)",5.0],["Large (Greenhouse)",500.0]];
// [[3d low, high], small mass (Earth), small density, medium mass, medium density, large mass, large density]
T.gasGiantPhysics = [[[-99,8],10.0,0.42,100.0,0.18,600.0,0.31],[[9,10],15.0,0.26,150.0,0.19,800.0,0.35],[[11,11],20.0,0.22,200.0,0.2,1000.0,0.4],[[12,12],30.0,0.19,250.0,0.22,1500.0,0.6],[[13,13],40.0,0.17,300.0,0.24,2000.0,0.8],[[14,14],50.0,0.17,350.0,0.25,2500.0,1.0],[[15,15],60.0,0.17,400.0,0.26,3000.0,1.2],[[16,16],70.0,0.17,450.0,0.27,3500.0,1.4],[[17,99],80.0,0.17,500.0,0.29,4000.0,1.6]];
// [upper limit in atm (null = no limit), category]
T.pressureCategories = [[0.01,"Trace"],[0.5,"Very Thin"],[0.8,"Thin"],[1.2,"Standard"],[1.5,"Dense"],[10.0,"Very Dense"],[null,"Superdense"]];
// [[3d low, high], constituent]
T.marginalConstituents = [[[3,4],"Chlorine or Fluorine"],[[5,6],"Sulfur Compounds"],[[7,7],"Nitrogen Compounds"],[[8,9],"Organic Toxins"],[[10,11],"Low Oxygen"],[[12,13],"Pollutants"],[[14,14],"High Carbon Dioxide"],[[15,16],"High Oxygen"],[[17,18],"Inert Gases"]];
// [upper limit in K (null = no limit), climate class]
T.climate = [[244,"Frozen"],[255,"Very Cold"],[266,"Cold"],[278,"Chilly"],[289,"Cool"],[300,"Normal"],[311,"Warm"],[322,"Tropical"],[333,"Hot"],[344,"Very Hot"],[null,"Infernal"]];
// [[3d low, high] for asteroids, [3d low, high] for other worlds, label, resource value modifier]
T.resourceValue = [[[3,3],null,"Worthless",-5],[[4,4],null,"Very Scant",-4],[[5,5],[-99,2],"Scant",-3],[[6,7],[3,4],"Very Poor",-2],[[8,9],[5,7],"Poor",-1],[[10,11],[8,13],"Average",0],[[12,13],[14,16],"Abundant",1],[[14,15],[17,18],"Very Abundant",2],[[16,16],[19,99],"Rich",3],[[17,17],null,"Very Rich",4],[[18,18],null,"Motherlode",5]];
// [[3d low, high], activity level]
T.volcanic = [[[-99,16],"None"],[[17,20],"Light"],[[21,26],"Moderate"],[[27,70],"Heavy"],[[71,99],"Extreme"]];
// [atmosphere, day-face factor, night-face factor, final atmosphere, hydrographics penalty]
T.tideLocked = [["None or Trace",1.2,0.1,"None","-100%"],["Very Thin",1.2,0.1,"Trace","-100%"],["Thin",1.16,0.67,"Very Thin","-50%"],["Standard",1.12,0.8,"Standard","-25%"],["Dense",1.09,0.88,"Dense","-10%"],["Very Dense",1.05,0.95,"Very Dense","-0%"],["Superdense",1.0,1.0,"Superdense","-0%"]];
return T;
});
