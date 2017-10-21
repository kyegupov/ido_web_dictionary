import glob
import yaml

def wrap(s):
    res = ''
    remainder = s
    while len(remainder) > 100:
        idx = remainder.rfind(' ', 0, 100)
        if idx<=0:
            idx = remainder.find(' ')
        if idx <=0:
            return res + remainder
        res += remainder[:idx] + '\n'
        remainder = remainder[idx+1:]
    return res + remainder


for dir in glob.glob('backend/src/main/resources/dictionaries_by_letter/*'):
    for fn in glob.glob(dir + '/*.yaml'):
        print(fn)

        articles = yaml.load(open(fn, encoding='utf-8'))

        fn2 = fn.replace(".yaml", ".txt")

        open(fn2, 'wt', encoding='utf-8').write('\n\n'.join([wrap(a) for a in articles]) + '\n')

