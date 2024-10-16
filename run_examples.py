import os
from cutiepynb.core import cutiepy_nb

def run_example_notebooks():
    example_files = [
        './examples/Test.ipynb',
        #'./examples/Another_example.ipynb'
    ]

    for file in example_files:
        cutiepy_nb(file, colors=['#40498e', '#357ba3', '#38aaac', '#79d6ae'], save=True)
        print(f"Processed notebook: {file}")

if __name__ == '__main__':
    run_example_notebooks()