from pathlib import Path
import sys,math,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'scripts'))
from kinematics import ik,fk
assert [x.get('name') for x in ET.parse(root/'scene.xml').findall('.//joint')]==['joint1','joint2','joint3']
assert [x.get('name') for x in ET.parse(root/'robot.urdf').findall('.//joint') if x.get('type')=='revolute']==['joint1','joint2','joint3']
for x,y,a in [(.15,.06,0),(.08,.1,1.2)]:
    q=ik(x,y,a);u,v=fk(q);assert math.hypot(u-x,v-y)<1e-8
print('XML and FK/IK checks passed. MuJoCo runtime and mesh presence not checked.')
