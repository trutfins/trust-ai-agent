from PIL import Image, ImageDraw, ImageFont
W='/tmp/claude-0/work/'
F=lambda s: ImageFont.truetype(W+'plex-ar-600.ttf', s, layout_engine=ImageFont.Layout.RAQM)
def mask(d, box, fill, tcol, size, label='مخفي'):
    x0,y0,x1,y1=box
    d.rounded_rectangle(box, radius=min(8,(y1-y0)//2), fill=fill)
    f=F(size); l,t,r,b=d.textbbox((0,0),label,font=f,direction='rtl',language='ar')
    d.text(((x0+x1-(r-l))/2-l,(y0+y1-(b-t))/2-t),label,font=f,fill=tcol,direction='rtl',language='ar')
r1=Image.open(W+'report/r1s.png').convert('RGB'); d=ImageDraw.Draw(r1)
dark=((52,72,100),(214,224,236)); light=((222,228,236),(70,86,106))
mask(d,(1690,26,1803,64),*dark,20)          # company name (header)
mask(d,(1722,82,1800,106),*dark,14)         # city (header)
d.rectangle((1552,425,1568,434),fill=r1.getpixel((1580,440)))
mask(d,(1214,433,1566,457),*light,15)       # report date/time + reference
mask(d,(1470,708,1552,738),*light,16)       # company name field
mask(d,(800,708,881,738),*light,16)         # address field
r2=Image.open(W+'report/r2s.png').convert('RGB').crop((0,0,1482,525)); r3=Image.open(W+'report/r3s.png').convert('RGB')
Wd=r1.width; gap=28
H=r1.height+gap+r2.height+gap+r3.height+gap
out=Image.new('RGB',(Wd,H),(255,255,255))
y=0
for im in (r1,r2,r3):
    out.paste(im,((Wd-im.width)//2,y)); y+=im.height+gap
out.save('/mnt/project-files/portfolio-section/report-merged.png',optimize=True)
out.save(W+'report/merged.webp','WEBP',quality=88,method=6)
print(out.size)
