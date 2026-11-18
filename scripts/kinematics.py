"""Planar 3R kinematics. Pen is at Link3 local x=60 mm, not 28 mm."""
import math
L1,L2,L3=.120,.100,.060
def fk(q):
    a,b,c=q
    return (L1*math.cos(a)+L2*math.cos(a+b)+L3*math.cos(a+b+c),
            L1*math.sin(a)+L2*math.sin(a+b)+L3*math.sin(a+b+c))
def ik(x,y,heading=0,elbow=1):
    wx=x-L3*math.cos(heading);wy=y-L3*math.sin(heading)
    co=(wx*wx+wy*wy-L1*L1-L2*L2)/(2*L1*L2)
    if not -1<=co<=1:raise ValueError('Pen position outside workspace')
    q2=elbow*math.acos(max(-1,min(1,co)))
    q1=math.atan2(wy,wx)-math.atan2(L2*math.sin(q2),L1+L2*math.cos(q2))
    q3=heading-q1-q2
    if max(map(abs,(q1,q2,q3)))>math.pi:raise ValueError('Joint limit exceeded')
    return (q1,q2,q3)
