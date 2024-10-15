import os
import json
from cutiepynb.core import cutipy_nb

def test_cutipy_nb():
    # Path to the test notebook
    test_file = './docs/examples/Test.ipynb'
    cutipy_nb(test_file, colors=['#40498e', '#357ba3'], save=True)

    # Check that the modified file exists and has the expected changes
    modified_file = './docs/examples/Test_chulo.ipynb'
    assert os.path.exists(modified_file)

    with open(modified_file, 'r') as f:
        notebook_content = json.load(f)
        assert 'Table of Contents' in ''.join(notebook_content['cells'][0]['source'])

    print("All tests passed!")
