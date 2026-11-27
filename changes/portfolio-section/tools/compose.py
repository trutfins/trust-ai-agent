from PIL import Image, ImageDraw, ImageFilter
import sys
W='/tmp/claude-0/work/'
s1=Image.open(W+'src/sala1.png').convert('RGB')
s2=Image.open(W+'src/sala2.png').convert('RGB')
# blur brand text inside the browser mock of screenshot 2
for box in [(288,188,360,220),(600,250,685,284)]:
    r=s2.crop(box).filter(ImageFilter.GaussianBlur(7)); s2.paste(r,box)
s2c=s2.crop((30,100,1500,480))  # drop site header (logo/nav) and footer note
def bg(w,h):
    im=Image.new('RGB',(w,h))
    d=ImageDraw.Draw(im)
    top=(15,34,54); bot=(30,60,88)
    for y in range(h):
        t=y/h; d.line([(0,y),(w,y)],fill=tuple(int(top[i]+(bot[i]-top[i])*t) for i in range(3)))
    d.rounded_rectangle((30,30,w-30,h-30),radius=28,outline=(120,104,72),width=2)
    return im
def shadowed(base,img,xy,rad=16):
    x,y=xy; w,h=img.size
    sh=Image.new('L',(w+80,h+80),0); ImageDraw.Draw(sh).rounded_rectangle((40,48,w+40,h+48),radius=rad,fill=120)
    sh=sh.filter(ImageFilter.GaussianBlur(18))
    base.paste((5,14,24),(x-40,y-40),sh)
    m=Image.new('L',img.size,0); ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),radius=rad,fill=255)
    base.paste(img,(x,y),m)
    ImageDraw.Draw(base).rounded_rectangle((x,y,x+w-1,y+h-1),radius=rad,outline=(201,161,90),width=2)
# desktop 1600x820
d=bg(1600,820)
a=s2c.resize((1180,int(380*1180/1470)),Image.LANCZOS)   # 1180x305
shadowed(d,a,(360,110))
b=s1.resize((int(798*430/757),430),Image.LANCZOS)        # ~453x430
shadowed(d,b,(90,330))
d.save(W+'out/assets/img/portfolio/pf-6-d.webp','WEBP',quality=80,method=6)
# mobile 760x890
m=bg(760,890)
a=s2c.resize((660,int(380*660/1470)),Image.LANCZOS)       # 660x171
shadowed(m,a,(50,90))
b=s1.resize((int(798*520/757),520),Image.LANCZOS)        # ~548x520
shadowed(m,b,(106,310))
m.save(W+'out/assets/img/portfolio/pf-6-m.webp','WEBP',quality=80,method=6)
