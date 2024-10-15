import uuid
import json

def generate_corpus_id():
    """Generate a random 8-character hexadecimal string using the uuid module."""
    return uuid.uuid4().hex[:8]

def save_doc_enchulado(doc_chulo, file):
    name_chulo  = file.split('.ipynb')[0]
    name_chulo += '_chulo.ipynb'
    with open(name_chulo, "w") as outfile:
        json.dump(doc_chulo, outfile)
    
    print('Saved as ',name_chulo)
