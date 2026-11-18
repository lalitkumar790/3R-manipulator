from pathlib import Path
import sys,math,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'scripts'))
from kinematics import ik,fk
for filename in ['scene.xml','src/writing-scene.xml']:
 tree=ET.parse(root/filename)
 joints=[x.attrib['name'] for x in tree.findall('.//joint')]
 assert joints==['joint1','joint2','joint3','pen_lift'],joints
assert [x.get('name') for x in ET.parse(root/'robot.urdf').findall('.//joint') if x.get('type')=='revolute']==['joint1','joint2','joint3']
for x,y,head in [(0.15,0.04,0),(0.105,0.07,0),(0.19,0.06,0)]:
 q=ik(x,y,head);p=fk(q);assert math.dist(p,(x,y))<1e-8,(q,p)
assert abs(fk((0,0,0))[0]-0.280)<1e-10
print('MJCF, URDF and FK/IK checks passed. Physics runtime not tested here.')
