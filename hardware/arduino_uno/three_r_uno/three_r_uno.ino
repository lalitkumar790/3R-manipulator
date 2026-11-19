/*
  3R / Arduino Uno / THREE ULN2003 boards / assumed 28BYJ-48 (5V).
  Four outputs per motor. External regulated supply for ALL motor boards.
  No built-in homing or encoders. Hardware emergency power disconnect required.
  This controller is an OPEN-LOOP bench prototype, NOT a safety-rated controller.
*/
#include <Arduino.h>
#include <Servo.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

// Each row maps ULN2003 IN1, IN2, IN3, IN4, in precisely this order.
// 12 Uno digital outputs; A0 optionally drives a dedicated pen-lift servo.
const uint8_t COIL_PINS[3][4] = {
  {2,3,4,5},     // Joint 1 ULN2003 IN1..IN4
  {6,7,8,9},     // Joint 2 ULN2003 IN1..IN4
  {10,11,12,13} // Joint 3 ULN2003 IN1..IN4
};
const uint8_t PEN_SERVO_PIN=A0;
const bool PEN_LIFT_INSTALLED=false; // ONLY true after testing real pen-lift mechanism
const uint8_t PEN_UP_DEG=45, PEN_DOWN_DEG=70; // MECHANICALLY CALIBRATE
// Nominal 28BYJ-48 half steps per output revolution.
// Exact gearbox can be ~4076 rather than nominal 4096: calibrate per motor.
const float HALFSTEPS_PER_REV[3]={4096.0,4096.0,4096.0};
const float JOINT_GEAR_RATIO[3]={1.0,1.0,1.0}; // motor output / joint rotation
const int8_t DIR_SIGN[3]={1,1,1}; // flip -1 if physical direction reversed
const long MAX_ABS_MDEG=150000L; // placeholder software guard, NOT mechanical fit
const unsigned long WATCHDOG_MS=1000UL;
// Maximum step rate ~400 HALF-STEPS/sec/axis. Slow enough for initial testing.
const unsigned long MIN_STEP_US=2500UL;
const uint8_t HALFSTEP[8]={
  0b0001,0b0011,0b0010,0b0110,
  0b0100,0b1100,0b1000,0b1001
};
Servo penServo;
bool armed=false,zeroed=false,halted=false;
long currentSteps[3]={0,0,0}, targetSteps[3]={0,0,0};
unsigned long lastPing=0,lastStepUs[3]={0,0,0},lastStatusMs=0;
char rx[70]; uint8_t used=0;
void deenergize(){
  for(uint8_t axis=0;axis<3;axis++)
    for(uint8_t coil=0;coil<4;coil++)digitalWrite(COIL_PINS[axis][coil],LOW);
}
void setPhase(uint8_t axis, long step){
  const uint8_t bits=HALFSTEP[(uint8_t)(step&7)];
  for(uint8_t coil=0;coil<4;coil++)
    digitalWrite(COIL_PINS[axis][coil],(bits&(1U<<coil))?HIGH:LOW);
}
void liftPen(){if(PEN_LIFT_INSTALLED)penServo.write(PEN_UP_DEG);}
void disableAll(){armed=false;deenergize();liftPen();}
bool number(const char* str,long &out) {
 if(!str || !*str)return false;
 char* end=nullptr;long v=strtol(str,&end,10);
 if(end==str || *end!='\0')return false;
 out=v;return true;
}
long angleToSteps(uint8_t axis,long milliDeg){
 const float turns=(float)milliDeg/360000.0f;
 return lroundf(turns*HALFSTEPS_PER_REV[axis]*JOINT_GEAR_RATIO[axis]*DIR_SIGN[axis]);
}
void state(){
 Serial.print(F("STATE,"));Serial.print(armed?1:0);
 for(uint8_t i=0;i<3;i++){Serial.print(',');Serial.print(currentSteps[i]);}
 Serial.println();
}
void command(char* input){
 char* op=strtok(input,",");if(!op)return;
 if(!strcmp(op,"HELLO")){
   Serial.println(PEN_LIFT_INSTALLED?F("HELLO,3R-UNO,1,PEN=1,BOARD=ULN2003,STEPS=4096"):F("HELLO,3R-UNO,1,PEN=0,BOARD=ULN2003,STEPS=4096"));
   return;
 }
 if(!strcmp(op,"STOP")){disableAll();zeroed=false;halted=true;Serial.println(F("OK,STOP"));return;}
 if(!strcmp(op,"DISARM")){disableAll();Serial.println(F("OK,DISARM"));return;}
 if(!strcmp(op,"PING")){
   if(armed)lastPing=millis();
   Serial.println(F("OK,PING"));return;
 }
 if(!strcmp(op,"STATUS")){state();return;}
 if(!strcmp(op,"ZERO")){
   if(armed){Serial.println(F("ERR,DISARM_FIRST"));return;}
   for(uint8_t i=0;i<3;i++){currentSteps[i]=0;targetSteps[i]=0;}
   zeroed=true;halted=false;Serial.println(F("OK,ZERO"));return;
 }
 if(!strcmp(op,"ARM")){
   if(!zeroed || halted){Serial.println(F("ERR,SET_ZERO"));return;}
   // Holding current is applied when armed; expect motor heating.
   armed=true;lastPing=millis();
   for(uint8_t i=0;i<3;i++)setPhase(i,currentSteps[i]);
   Serial.println(F("OK,ARM"));return;
 }
 if(!strcmp(op,"Q")){
   if(!armed || !zeroed){Serial.println(F("ERR,NOT_ARMED"));return;}
   long f[5];
   for(uint8_t i=0;i<5;i++){if(!number(strtok(NULL,","),f[i])){Serial.println(F("ERR,FORMAT"));return;}}
   if(strtok(NULL,",")){Serial.println(F("ERR,FORMAT"));return;}
   if(f[0]<0 || f[4]<0 || f[4]>12000){Serial.println(F("ERR,RANGE"));return;}
   for(uint8_t i=0;i<3;i++)
     if(f[i+1] < -MAX_ABS_MDEG || f[i+1] > MAX_ABS_MDEG){Serial.println(F("ERR,RANGE"));return;}
   if(!PEN_LIFT_INSTALLED && f[4]<8000){Serial.println(F("ERR,NO_PEN_LIFT"));return;}
   for(uint8_t i=0;i<3;i++)targetSteps[i]=angleToSteps(i,f[i+1]);
   if(PEN_LIFT_INSTALLED)penServo.write(map(f[4],0,12000,PEN_DOWN_DEG,PEN_UP_DEG));
   lastPing=millis();
   Serial.print(F("ACK,Q,"));Serial.println(f[0]);return;
 }
 Serial.println(F("ERR,UNKNOWN_COMMAND"));
}
void setup(){
 for(uint8_t axis=0;axis<3;axis++)
   for(uint8_t coil=0;coil<4;coil++){pinMode(COIL_PINS[axis][coil],OUTPUT);digitalWrite(COIL_PINS[axis][coil],LOW);}
 if(PEN_LIFT_INSTALLED){penServo.attach(PEN_SERVO_PIN);liftPen();}
 Serial.begin(115200);
 lastPing=millis();
}
void loop(){
 while(Serial.available()){
  const char ch=(char)Serial.read();
  if(ch=='\r')continue;
  if(ch=='\n'){rx[used]='\0';if(used)command(rx);used=0;}
  else if(used < sizeof(rx)-1)rx[used++]=ch;
  else{used=0;Serial.println(F("ERR,LINE_TOO_LONG"));}
 }
 if(armed && (unsigned long)(millis()-lastPing)>WATCHDOG_MS){
   disableAll();zeroed=false;halted=true;Serial.println(F("FAULT,TIMEOUT"));
 }
 if(!armed)return;
 for(uint8_t axis=0;axis<3;axis++){
  if(currentSteps[axis]==targetSteps[axis])continue;
  const unsigned long now=micros();
  if((unsigned long)(now-lastStepUs[axis])<MIN_STEP_US)continue;
  currentSteps[axis]+=(targetSteps[axis]>currentSteps[axis])?1:-1;
  setPhase(axis,currentSteps[axis]);
  lastStepUs[axis]=now;
 }
 if((unsigned long)(millis()-lastStatusMs)>250){
   lastStatusMs=millis();state();
 }
}
