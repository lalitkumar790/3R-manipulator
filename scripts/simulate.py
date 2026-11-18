#!/usr/bin/env python3
"""Run the provisional 3R MuJoCo model (requires original STL meshes)."""
import argparse, time
from pathlib import Path
import numpy as np, mujoco
def main():
    p=argparse.ArgumentParser();p.add_argument('--headless',action='store_true');p.add_argument('--seconds',type=float,default=15);p.add_argument('--demo',action='store_true')
    a=p.parse_args();m=mujoco.MjModel.from_xml_path(str(Path(__file__).resolve().parents[1]/'scene.xml'));d=mujoco.MjData(m)
    def tick():
        if a.demo:d.ctrl[:]=[.6*np.sin(d.time),.7*np.sin(.7*d.time),.55*np.sin(1.3*d.time)]
        mujoco.mj_step(m,d)
    if a.headless:
        for _ in range(int(a.seconds/m.opt.timestep)):tick()
        i=mujoco.mj_name2id(m,mujoco.mjtObj.mjOBJ_SITE,'pen_tip');print(d.time,d.qpos[:],d.site_xpos[i])
    else:
        import mujoco.viewer
        with mujoco.viewer.launch_passive(m,d) as viewer:
            end=time.monotonic()+a.seconds
            while viewer.is_running() and time.monotonic()<end:
                start=time.monotonic();tick();viewer.sync();time.sleep(max(0,m.opt.timestep-(time.monotonic()-start)))
if __name__=='__main__':main()
