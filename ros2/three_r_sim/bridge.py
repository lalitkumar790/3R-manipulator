"""ROS 2 /joint_commands bridge for the MJCF 3R arm + auxiliary pen lift."""
from pathlib import Path
from ament_index_python.packages import get_package_share_directory
import mujoco,rclpy
from rclpy.node import Node
from sensor_msgs.msg import JointState
from geometry_msgs.msg import PointStamped
class Bridge(Node):
 def __init__(self):
  super().__init__('three_r_mujoco')
  self.model=mujoco.MjModel.from_xml_path(str(Path(get_package_share_directory('three_r_sim'))/'scene.xml'))
  self.data=mujoco.MjData(self.model);self.names=['joint1','joint2','joint3','pen_lift']
  self.target=[-.85,1.4,-.55,.012];self.data.qpos[:4]=self.target
  mujoco.mj_forward(self.model,self.data)
  self.pub=self.create_publisher(JointState,'joint_states',10);self.penpub=self.create_publisher(PointStamped,'pen_tip_pose',10)
  self.sub=self.create_subscription(JointState,'joint_commands',self.on_cmd,10)
  self.pen_id=mujoco.mj_name2id(self.model,mujoco.mjtObj.mjOBJ_SITE,'pen_tip');self.timer=self.create_timer(.01,self.step)
 def on_cmd(self,msg):
  if msg.name:
   mapping=dict(zip(msg.name,msg.position))
   for i,name in enumerate(self.names):
    if name in mapping:self.target[i]=float(mapping[name])
  elif len(msg.position)>=3:
   self.target[:3]=list(map(float,msg.position[:3]))
   if len(msg.position)>=4:self.target[3]=float(msg.position[3])
 def step(self):
  self.data.ctrl[:4]=self.target
  for _ in range(5):mujoco.mj_step(self.model,self.data)
  stamp=self.get_clock().now().to_msg();j=JointState();j.header.stamp=stamp;j.name=self.names
  j.position=list(map(float,self.data.qpos[:4]));j.velocity=list(map(float,self.data.qvel[:4]));self.pub.publish(j)
  p=PointStamped();p.header.stamp=stamp;p.header.frame_id='base_link'
  p.point.x=float(self.data.site_xpos[self.pen_id,0]);p.point.y=float(self.data.site_xpos[self.pen_id,1]);p.point.z=float(self.data.site_xpos[self.pen_id,2]);self.penpub.publish(p)
def main():
 rclpy.init();node=Bridge()
 try:rclpy.spin(node)
 finally:node.destroy_node();rclpy.shutdown()
if __name__=='__main__':main()
