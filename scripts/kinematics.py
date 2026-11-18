"""Planar 3R forward/inverse kinematics. Units: meters and radians."""
import math
L1,L2,L3=.120,.100,.028
def fk(q):
    a,b,c=q
    return (L1*math.cos(a)+L2*math.cos(a+b)+L3*math.cos(a+b+c),L1*math.sin(a)+L2*math.sin(a+b)+L3*math.sin(a+b+c))
def ik(x,y,heading,elbow=1):
    wx=x-L3*math.cos(heading);wy=y-L3*math.sin(heading)
    co=(wx*wx+wy*wy-L1*L1-L2*L2)/(2*L1*L2)
    if not -1-1e-9<=co<=1+1e-9:raise ValueError('Unreachable')
    q2=elbow*math.acos(max(-1,min(1,co)))
    q1=math.atan2(wy,wx)-math.atan2(L2*math.sin(q2),L1+L2*math.cos(q2))
    return q1,q2,heading-q1-q2
if __name__=='__main__':
    q=ik(.15,.06,0);print(q,fk(q))
