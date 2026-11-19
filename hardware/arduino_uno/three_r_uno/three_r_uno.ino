/*
  3R Manipulator — Arduino Uno step/dir controller, protocol v1
  NOT a motor-power circuit. Use external STEP/DIR drivers + external supply.
  DRIVER ENABLE defaults OFF. ZERO is a user-declared position, NOT homing.
  Do not operate around people; add a hardwired emergency power cutoff, endstops,
  and mechanical calibration before connecting a real robot.
*/
#include <Arduino.h>
#include <Servo.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>

// D2/D3, D4/D5, D6/D7 → three external motor drivers STEP / DIR.
const byte STEP_PIN[3]={2,4,6};
const byte DIR_PIN[3]={3,5,7};
const byte ENABLE_PIN=8; // LOW=enabled on common drivers; verify your driver.
const byte PEN_PIN=9;
const bool PEN_LIFT_INSTALLED=false; // Set true ONLY after wiring/testing servo.
const int PEN_UP_DEG=45, PEN_DOWN_DEG=70; // CALIBRATE mechanism first.
const long STEPS_PER_REV=200, MICROSTEPS=16;
const float GEAR[3]={1.0f,1.0f,1.0f}; // Configure joint transmission ratio!
const long MAX_ABS_MDEG=150000L; // Conservative software limit, not a physical limit.
const unsigned long WATCHDOG_MS=1000UL;
const unsigned long STEP_INTERVAL_US=2500UL; // <=400 steps/s/axis
const unsigned int STEP_PULSE_US=4;
Servo penServo;
bool armed=false,zeroed=false,stopped=false;
long currentSteps[3]={0,0,0},targetSteps[3]={0,0,0};
unsigned long lastPing=0,lastStep[3]={0,0,0},lastStatus=0;
char line[64];byte used=0;
void drivers(bool on){digitalWrite(ENABLE_PIN,on?LOW:HIGH);}
void raisePen(){if(PEN_LIFT_INSTALLED)penServo.write(PEN_UP_DEG);}
void disableAll(){armed=false;drivers(false);raisePen();}
long angleToSteps(byte axis,long md){
  return lroundf(float(md)*float(STEPS_PER_REV)*float(MICROSTEPS)*GEAR[axis]/360000.0f);
}
bool parseLong(char *str,long *out){
  if(!str||!*str)return false;
  char *end;long x=strtol(str,&end,10);
  if(end==str||*end!='\0')return false;
  *out=x;return true;
}
void ack(const __FlashStringHelper *s){Serial.println(s);}
void command(char *input){
 char *op=strtok(input,",");if(!op)return;
 if(!strcmp(op,"HELLO")){Serial.println(PEN_LIFT_INSTALLED?F("HELLO,3R-UNO,1,PEN=1"):F("HELLO,3R-UNO,1,PEN=0"));return;}
 if(!strcmp(op,"PING")){lastPing=millis();Serial.println(F("OK,PING"));return;}
 if(!strcmp(op,"STOP")){disableAll();zeroed=false;stopped=true;Serial.println(F("OK,STOP"));return;}
 if(!strcmp(op,"DISARM")){disableAll();Serial.println(F("OK,DISARM"));return;}
 if(!strcmp(op,"ZERO")){
   if(armed){Serial.println(F("ERR,DISARM_FIRST"));return;}
   for(byte i=0;i<3;i++){currentSteps[i]=0;targetSteps[i]=0;}
   zeroed=true;stopped=false;Serial.println(F("OK,ZERO"));return;
 }
 if(!strcmp(op,"ARM")){
   if(!zeroed||stopped){Serial.println(F("ERR,SET_ZERO"));return;}
   lastPing=millis();armed=true;drivers(true);Serial.println(F("OK,ARM"));return;
 }
 if(!strcmp(op,"STATUS")){
   Serial.print(F("STATE,"));Serial.print(armed?1:0);
   for(byte i=0;i<3;i++){Serial.print(',');Serial.print(currentSteps[i]);}
   Serial.println();return;
 }
 if(!strcmp(op,"Q")){
   if(!armed||!zeroed){Serial.println(F("ERR,NOT_ARMED"));return;}
   long fields[5];
   for(byte i=0;i<5;i++){if(!parseLong(strtok(NULL,","),&fields[i])){Serial.println(F("ERR,FORMAT"));return;}}
   if(strtok(NULL,",")){Serial.println(F("ERR,FORMAT"));return;}
   if(fields[0]<0||fields[4]<0||fields[4]>12000){Serial.println(F("ERR,RANGE"));return;}
   for(byte i=0;i<3;i++)if(fields[i+1]<-MAX_ABS_MDEG||fields[i+1]>MAX_ABS_MDEG){Serial.println(F("ERR,RANGE"));return;}
   // A pen-down command is rejected until a physical lift servo is installed.
   if(!PEN_LIFT_INSTALLED && fields[4]<8000){Serial.println(F("ERR,NO_PEN_LIFT"));return;}
   long next[3];for(byte i=0;i<3;i++)next[i]=angleToSteps(i,fields[i+1]);
   for(byte i=0;i<3;i++)targetSteps[i]=next[i];
   if(PEN_LIFT_INSTALLED)penServo.write(map(fields[4],0,12000,PEN_DOWN_DEG,PEN_UP_DEG));
   lastPing=millis();
   Serial.print(F("ACK,Q,"));Serial.println(fields[0]);return;
 }
 Serial.println(F("ERR,UNKNOWN_COMMAND"));
}
void setup(){
 for(byte i=0;i<3;i++){pinMode(STEP_PIN[i],OUTPUT);pinMode(DIR_PIN[i],OUTPUT);digitalWrite(STEP_PIN[i],LOW);digitalWrite(DIR_PIN[i],LOW);}
 pinMode(ENABLE_PIN,OUTPUT);drivers(false);
 if(PEN_LIFT_INSTALLED){penServo.attach(PEN_PIN);raisePen();}
 Serial.begin(115200);lastPing=millis();
}
void loop(){
 while(Serial.available()){
   char c=char(Serial.read());
   if(c=='\r')continue;
   if(c=='\n'){
     line[used]='\0';if(used)command(line);used=0;
   }else if(used<sizeof(line)-1)line[used++]=c;
   else {used=0;Serial.println(F("ERR,LINE_TOO_LONG"));}
 }
 if(armed && (unsigned long)(millis()-lastPing)>WATCHDOG_MS){
   disableAll();zeroed=false;Serial.println(F("FAULT,TIMEOUT"));
 }
 if(!armed)return;
 const unsigned long now=micros();
 for(byte i=0;i<3;i++){
   if(targetSteps[i]==currentSteps[i])continue;
   if((unsigned long)(now-lastStep[i])<STEP_INTERVAL_US)continue;
   const bool positive=targetSteps[i]>currentSteps[i];
   digitalWrite(DIR_PIN[i],positive?HIGH:LOW);
   delayMicroseconds(4);
   digitalWrite(STEP_PIN[i],HIGH);
   delayMicroseconds(STEP_PULSE_US);
   digitalWrite(STEP_PIN[i],LOW);
   currentSteps[i]+=positive?1:-1;lastStep[i]=now;
 }
 if((unsigned long)(millis()-lastStatus)>250){
   lastStatus=millis();
   Serial.print(F("STATE,1"));
   for(byte i=0;i<3;i++){Serial.print(',');Serial.print(currentSteps[i]);}
   Serial.println();
 }
}
