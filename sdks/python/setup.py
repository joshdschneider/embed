from setuptools import setup, find_packages

setup(
    name='kit',
    version='0.1.0',
    author='Kit',
    author_email='team@kit.zip',
    packages=find_packages(),
    install_requires=['requests>=2.25.1'],
    description='Python SDK for Kit',
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
)