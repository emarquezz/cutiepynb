import json 
import re
#import seaborn as sns  # Make it conditional 

from .utils import generate_corpus_id, save_doc_enchulado
from .styles import maquillate, update_heading_colors_in_document

def create_new_document(document, colors):
    """
    Add a table of contents and anchors to headings in a Jupyter notebook.
    
    Args:
        document (Dict[str, Union[str, Dict[str, Any], List[Dict[str, Any]]]]): A dictionary representing a Jupyter notebook.
        colors (Optional[List[str]]): A list of colors to be used for the headings.
        
    Returns:
        Dict[str, Union[str, Dict[str, Any], List[Dict[str, Any]]]]: The modified Jupyter notebook with the table of contents and anchors added.
    """
    cells = document['cells']
    info_to_add, new_cells = generate_new_cells(cells, colors)
    table_of_contents = generate_contents(info_to_add)
    document['cells'] = [table_of_contents] + new_cells
    return document

def generate_new_cells(cells, colors):
    """
    Generate a list of cells with anchors and, optionally, colored headings added.
    
    Args:
        cells (List[Dict[str, Union[str, Dict[str, Any], List[str]]]]): A list of dictionaries representing the cells in a Jupyter notebook.
        colors (Optional[List[str]]): A list of colors to be used for the headings.
        
    Returns:
        Tuple[Dict[int, Dict[str, Any]], List[Dict[str, Union[str, Dict[str, Any], List[str]]]]]: A tuple with a dictionary of heading information and a list of modified cells.
    """
    info_to_add = {}
    new_cells = []
    for cell in cells:
        if cell['cell_type'] != 'markdown':
            new_cells.append(cell)
            continue
        source = cell['source']
        
        if not source or not source[0].startswith('#'):
            new_cells.append(cell)
            continue
            
        info_to_add = extract_info(source, info_to_add)
        number = len(info_to_add) - 1
        if number < 0:
            new_cells.append(cell)
            continue
            
        values = info_to_add[number]
        new_cell = cell
        new_source = create_source_anchor(source, values, colors)
        new_cell['source'] = new_source
        new_cells.append(new_cell)
    return info_to_add, new_cells

def generate_contents(info_to_add):
    """
    Generate a markdown cell with a table of contents based on the heading information in a dictionary.
    
    Args:
        info_to_add (Dict[int, Dict[str, Any]]): A dictionary with the heading information, with keys corresponding to integers.
        
    Returns:
        Dict[str, Union[str, Dict[str, Any], List[str]]]: A dictionary representing a markdown cell with the table of contents.
    """
    cell_id = generate_corpus_id()
    table_of_contents = {'cell_type': 'markdown', 'id': str(cell_id),
                         'metadata': {}, 'source': [' # Table of Contents\n']}

    for title_numb in sorted(info_to_add):
        line = format_title_index(title_numb, info_to_add)
        table_of_contents['source'].append(line)
        
    return table_of_contents


def create_source_anchor(source, values, colors):
    """
    Add an HTML anchor element and, optionally, color to a heading in a markdown cell.
    
    Args:
        source (List[str]): The source list of strings for the markdown cell.
        values (Dict[str, Any]): A dictionary with the keys 'anchor', 'title', and 'level'.
        colors (Optional[List[str]]): A list of colors to be used for the headings.
        
    Returns:
        List[str]: The modified source list with the anchor element and, optionally, colored heading added.
    """
    anchor = values['anchor']
    title = values['title']
    level = values['level']
    
    # Create the anchor element
    term_i = '<a class="anchor" id="'
    term_f = '"></a>\n'
    full_term = term_i + anchor + term_f
    # Optional: style the title with colors
    if colors:
        title = maquillate(title, level, colors, span=False)

        
    # Add a span with a dynamic class based on the title level
    span_class = f"title_{level}"
    title_html = f'<span class={span_class}{title}</span>'
    
    # Create the new source list with the anchor and title
    new_source = [full_term] + source
    new_source[1] = f"#{'#' * level} {title_html}"
    return new_source

def format_title_index(title_numb, titles):
    """
    Format a heading for inclusion in the table of contents.
    
    Args:
        title_numb (int): The key for the heading information in the titles dictionary.
        titles (Dict[int, Dict[str, Any]]): A dictionary with the heading information, with keys corresponding to integers.
        
    Returns:
        str: A string with the formatted heading.
    """
    title = titles[title_numb]
    
    anchor = title['anchor']
    level = '\t' * title['level']
    title_format = '[' + title['title'] + ']'
    term = f'((?:^|\\W){re.escape(anchor)}(?:$|\\W))'
    anchor = re.sub(term, r'(#\1)', anchor)
    
    line = level + '+ ' + title_format + anchor + '\n'
    
    return line

def extract_info(source, titles):
    """
    Extract heading information from a markdown cell and store it in a dictionary.
    
    Args:
        source (List[str]): The source list of strings for the markdown cell.
        titles (Dict[int, Dict[str, Any]]): A dictionary to store the heading information, with auto-incrementing keys.
        
    Returns:
        Dict[int, Dict[str, Any]]: The modified dictionary with the extracted heading information.
    """
    for i, word in enumerate(source):
        if word.startswith('#'):
            level = len(re.findall('#', word)) - 1
            title = word[level + 2:]
            anchor = title.rstrip().replace(' ', '_') + '_' + str(len(titles))
            titles[len(titles)] = {'title': title, 'level': level, 'anchor': anchor}
    return titles


def enchular_ipynb(file, sns_palette=None, colors=None, update_colors=None):
    """
    Add a table of contents and anchors to headings in a Jupyter notebook.
    Optionally update the colors of the titles directly in the markdown cells.

    Args:
        file (str): The path to the Jupyter notebook file.
        sns_palette (Optional[str]): A string representing a seaborn color palette to be used for the headings.
        colors (Optional[List[str]]): A list of colors to be used for the headings.
        update_colors (Optional[List[str]]): A new list of colors to update the titles with.

    Returns:
        Dict[str, Union[str, Dict[str, Any], List[Dict[str, Union[str, Dict[str, Any], List[str]]]]]]: The modified Jupyter notebook.
    """
    if sns_palette:
        pal = sns.color_palette(sns_palette, len(sns_palette))
        colors = [i for i in pal]
    else:
        colors = colors
    
    with open(file, 'r') as f:
        document = json.load(f)
    
    # Add the table of contents and anchor elements to the headings
    document = create_new_document(document, colors)

    # If update_colors is provided, update the heading colors directly in the notebook
    if update_colors:
        document = update_heading_colors_in_document(document, update_colors)

    return document



def cutiepy_nb(file, sns_palette=None, colors=None, save=True, update_colors=None):
    doc_chulo = enchular_ipynb(file, sns_palette, colors, update_colors)
    if save:
        save_doc_enchulado(doc_chulo, file)
       