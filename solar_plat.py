# Plataformas (x0, x1, y do topo da grama) por cenario, em pixels do cenario (1672x941). Chao: y=885 em todos.
import math
GROUND = 885
LOCAL = [
 [ (205,520,425),(335,570,548),(525,885,507),(605,795,727),(825,1000,693),(1120,1355,565),(1310,1445,665),(1420,1560,455) ],
 [ (245,490,398),(500,730,455),(330,550,562),(310,480,648),(530,640,670),(640,790,603),(800,1015,628),(1000,1175,654),(680,965,758),(850,1075,512),(1330,1540,505),(1180,1330,728),(1140,1290,345) ],
 [ (110,350,575),(260,540,385),(400,650,538),(490,770,636),(745,1010,545),(830,1120,672),(1015,1280,727),(1080,1255,602),(1030,1300,400),(1155,1280,345),(1410,1560,435),(1370,1530,600) ],
 [ (130,250,330),(250,400,395),(200,350,552),(390,680,598),(670,845,700),(755,915,585),(880,1215,700),(990,1225,586),(1320,1500,622),(700,910,490),(1275,1465,335),(1455,1560,505),(1170,1500,370) ],
 [],
]
V0, G, RUN = 1060, 2500, 440
def reach(a, b):
    dy = a[2] - b[2]
    if dy > 205: return False
    t = (V0 + math.sqrt(max(0, V0 * V0 - 2 * G * dy))) / G
    gap = max(0, max(a[0], b[0]) - min(a[1], b[1]))
    return gap <= 0.85 * RUN * t if dy >= 0 else gap <= 0.85 * RUN * max(t, math.sqrt(2 * -dy / G) + V0 / G)
if __name__ == '__main__':
    for k, pl in enumerate(LOCAL):
        nodes = [(0, 1672, GROUND)] + list(pl)
        seen = {0}; st = [0]
        while st:
            a = st.pop()
            for j, b in enumerate(nodes):
                if j in seen: continue
                if reach(nodes[a], b) or (b[2] > nodes[a][2]):   # descer sempre da (queda)
                    if b[2] > nodes[a][2]:
                        gap = max(0, max(nodes[a][0], b[0]) - min(nodes[a][1], b[1]))
                        if gap > 330: continue
                    seen.add(j); st.append(j)
        miss = [nodes[j] for j in range(len(nodes)) if j not in seen]
        print('cenario', k + 1, 'plataformas', len(pl), 'inalcancaveis', miss)
