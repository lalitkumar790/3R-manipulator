from setuptools import setup
from glob import glob
p='three_r_sim'
setup(name=p,version='0.1.0',packages=[p],data_files=[('share/ament_index/resource_index/packages',['resource/'+p]),('share/'+p,['package.xml','scene.xml','robot.urdf']),('share/'+p+'/meshes',glob('meshes/*.stl'))],install_requires=['setuptools'],zip_safe=True,maintainer='3R team',maintainer_email='maintainer@example.invalid',description='MuJoCo ROS2 bridge',license='MIT',entry_points={'console_scripts':['three_r_bridge = three_r_sim.bridge:main']})
